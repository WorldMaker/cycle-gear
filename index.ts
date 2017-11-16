import { adapt } from '@cycle/run/lib/adapt'
import xs, { Observable } from 'xstream'
import flattenConcurrently from 'xstream/extra/flattenConcurrently'

export interface GearView<TModel> {
    (model: TModel): any
}

export interface GearTooth<TModel> {
    filter?: (model: TModel) => boolean
    view: GearView<TModel>
}

export interface GearTeeth<TModel> {
    [name: string]: GearTooth<TModel> | GearView<TModel>
}

export interface Gear<TActions, TModel> {
    name?: string
    catch?: (error: any, actions: TActions) => Observable<any>
    intent?: (sources: any) => TActions
    model?: (actions: TActions) => Observable<TModel>
    teeth?: GearTeeth<TModel>
}

export type ToothReduce<TActions, TModel, TTooth, TAccumulator> = (accumulator: TAccumulator, current: [TTooth, Gear<TActions, TModel>]) => TAccumulator

export interface ToothConnector<TActions, TModel, TTooth, TAccumulator> {
    fold?: boolean
    reduce?: ToothReduce<TActions, TModel, TTooth, TAccumulator>
    init?: () => TAccumulator
    isolate?: (sources: any, sink: Observable<any>, gear: Gear<TActions, TModel>) => Observable<any>
}

export type Transmission = ((sources: any) => Observable<Gear<any, any>>) | Observable<Gear<any, any>>

export type Gearbox = ((sources: any) => Observable<Iterable<Gear<any, any>>>) | Observable<Iterable<Gear<any, any>>>

export interface PedalOptions {
    defaultGear?: Gear<any, any>
    defaultFilter?: (model: any) => boolean
    sinkMap?: Map<string, string>
    sourcesWrapper?: (sources: any, gear: Gear<any, any>) => any
}

export interface MotorOptions extends PedalOptions {
    defaultConnector?: ToothConnector<any, any, any, any>
    connectors?: Map<string, ToothConnector<any, any, any, any>>
}

function defaultsAndHelpers(defaultGear: Gear<any, any>, defaultFilter: (model: any) => boolean) {
    const defaultCatch = defaultGear.catch || ((error: any) => xs.throw(error))
    const defaultIntent = defaultGear.intent || (() => ({}))
    const defaultModel = defaultGear.model || (() => xs.of({}))
    // Fully expand tooth defaults to avoid doing all the tests below every time
    const toothDefaults: {
        [name: string]: GearTooth<any>
    } = {}
    const teeth = Object.keys(defaultGear.teeth || {})
    const emptyTeeth = teeth.reduce((accum, cur) => Object.assign(accum, { [cur]: xs.never() }), {})
    if (defaultGear.teeth) {
        for (let tooth of teeth) {
            const defGearTooth = defaultGear.teeth[tooth]
            if (defGearTooth instanceof Function) {
                toothDefaults[tooth] = { filter: defaultFilter, view: defGearTooth }
            } else {
                toothDefaults[tooth] = { filter: defGearTooth.filter || defaultFilter, view: defGearTooth.view }
            }
        }
    }

    // Filter helper
    const toothFilter = (name: string, tooth: GearTooth<any> | GearView<any>) => {
        if (!tooth || tooth instanceof Function) {
            return toothDefaults[name].filter || defaultFilter
        } else {
            return tooth.filter || toothDefaults[name].filter || defaultFilter
        }
    }

    // View helper
    const toothView = (name: string, tooth: GearTooth<any> | GearView<any>) => {
        if (!tooth) {
            return toothDefaults[name].view
        } else if (tooth instanceof Function) {
            return tooth
        } else {
            return tooth.view
        }
    }

    return { defaultIntent, defaultModel, defaultCatch, teeth, toothFilter, toothView, emptyTeeth }
}

function spinGear(sources: any,
                  defaultIntent: (sources: any) => any,
                  defaultModel: (actions: any) => Observable<any>,
                  defaultCatch: (error: any, actions: any) => Observable<any>,
                  sourcesWrapper: (sources: any, gear: Gear<any, any>) => any,
                  teeth: string[],
                  toothFilter: (name: string, tooth: GearTooth<any> | GearView<any>) => (model: any) => boolean,
                  toothView: (name: string, tooth: GearTooth<any> | GearView<any>) => GearView<any>,
                  toothCombineGear = false,
                  defaultConnector: ToothConnector<any, any, any, any> = {},
                  connectors: Map<string, ToothConnector<any, any, any, any>> = new Map()): (t: Gear<any, any>) => {} {
    const modelCache = new WeakMap<Gear<any, any>, xs<any>>()
    return gear => {
        let state = modelCache.get(gear)
        if (!state) {
            const wrappedSources = sourcesWrapper(sources, gear)
            const actions = gear.intent ? gear.intent(wrappedSources) : defaultIntent(wrappedSources)
            state = xs.fromObservable(gear.model ? gear.model(actions) : defaultModel(actions))
                .replaceError((err: any) => xs.fromObservable(gear.catch ? gear.catch(err, actions) : defaultCatch(err, actions)))
                .remember()
            modelCache.set(gear, state)
        }
        const views = teeth.reduce((accum, tooth) => {
            let view = state!.filter(toothFilter(tooth, (gear.teeth || {})[tooth])).map(toothView(tooth, (gear.teeth || {})[tooth]))
            const isolator = connectors.has(tooth)
                ? connectors.get(tooth)!.isolate || defaultConnector.isolate
                : defaultConnector.isolate
            if (isolator) {
                view = xs.fromObservable(isolator(sources, view, gear))
            }
            if (toothCombineGear) {
                view = view.map(v => [v, gear])
            }
            return Object.assign(accum, {
                [tooth]: view
            })
        },
                                   {})
        return views
    }
}

export function pedal(transmission: Transmission, {
    defaultGear = { intent: () => ({}), model: () => xs.of({}), teeth: {} as GearTeeth<any> },
    defaultFilter = () => true,
    sinkMap = new Map(),
    sourcesWrapper = (sources: any) => sources
}: PedalOptions = {}) {
    const {
        defaultIntent,
        defaultModel,
        defaultCatch,
        teeth,
        toothFilter,
        toothView,
        emptyTeeth
    } = defaultsAndHelpers(defaultGear, defaultFilter)

    return (sources: any) => {
        let gear: Observable<Gear<any, any>>
        if (transmission instanceof Function) {
            gear = transmission(sources)
        } else {
            gear = transmission
        }

        const spin = xs.fromObservable<Gear<any, any>>(gear)
            .map(spinGear(sources, defaultIntent, defaultModel, defaultCatch, sourcesWrapper, teeth, toothFilter, toothView))
            .startWith(emptyTeeth)
            .remember()

        const sinks = teeth.reduce((accum, tooth) => Object.assign(accum, {
            [sinkMap.has(tooth) ? sinkMap.get(tooth) : tooth]: adapt(spin.map((views: any) => views[tooth]).flatten())
        }),
                                   {})

        return sinks
    }
}

const defaultReduce = (acc: any, [cur, gear]: [any, Gear<any, any>]) => ({ ...acc, [gear.name || '?']: cur })

function spinGears(sources: any,
                   defaultIntent: (sources: any) => any,
                   defaultModel: (actions: any) => Observable<any>,
                   defaultCatch: (error: any, actions: any) => Observable<any>,
                   teeth: string[],
                   toothFilter: (name: string, tooth: GearTooth<any> | GearView<any>) => (model: any) => boolean,
                   toothView: (name: string, tooth: GearTooth<any> | GearView<any>) => GearView<any>,
                   sourcesWrapper: (sources: any, gear: Gear<any, any>) => any,
                   defaultConnector: ToothConnector<any, any, any, any>,
                   connectors: Map<string, ToothConnector<any, any, any, any>>): (t: Iterable<Gear<any, any>>) => any[] {
    const spinCache = new WeakMap<Gear<any, any>, any>()
    const spinner = spinGear(sources,
                             defaultIntent,
                             defaultModel,
                             defaultCatch,
                             sourcesWrapper,
                             teeth,
                             toothFilter,
                             toothView,
                             true,
                             defaultConnector,
                             connectors)
    return gears => {
        const spins = []
        for (let gear of gears) {
            const cached = spinCache.get(gear)
            if (cached) {
                spins.push(cached)
            } else {
                const spinnning = spinner(gear)
                spinCache.set(gear, spinnning)
                spins.push(spinnning)
            }
        }
        return spins
    }
}

export function motor(gearbox: Gearbox, {
    defaultGear = { intent: () => ({}), model: () => xs.of({}), teeth: {} as GearTeeth<any> },
    defaultFilter = () => true,
    defaultConnector = {},
    sourcesWrapper = (sources: any) => sources,
    connectors = new Map(),
    sinkMap = new Map()
}: MotorOptions = {}) {
    const {
        defaultIntent,
        defaultModel,
        defaultCatch,
        teeth,
        toothFilter,
        toothView
    } = defaultsAndHelpers(defaultGear, defaultFilter)

    return (sources: any) => {
        let gears: Observable<Iterable<Gear<any, any>>>
        if (gearbox instanceof Function) {
            gears = gearbox(sources)
        } else {
            gears = gearbox
        }

        const spin = xs.fromObservable<Iterable<Gear<any, any>>>(gears)
            .map(spinGears(sources, defaultIntent, defaultModel, defaultCatch, teeth, toothFilter, toothView, sourcesWrapper, defaultConnector, connectors))
            .startWith([])
            .remember()

        const sinks = teeth.reduce((accum, tooth) => {
            let view = spin.map(spins => xs.fromArray(spins)
                    .map(gear => gear[tooth])
                    .filter(toothView => !!toothView)
                    .compose(flattenConcurrently))
                .flatten()
            const connector = connectors.get(tooth) || defaultConnector
            if (connector.fold) {
                view = view.fold(connector.reduce || defaultReduce, connector.init || {})
            } else {
                view = view.map(([cur]: [any]) => cur)
            }
            return {
                ...accum,
                [sinkMap.has(tooth) ? sinkMap.get(tooth) : tooth]: adapt(view)
            }
        },
                                   {})

        return sinks
    }
}
