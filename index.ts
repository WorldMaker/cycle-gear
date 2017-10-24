import { adapt } from '@cycle/run/lib/adapt'
import xs, { Observable } from 'xstream'

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
    catch?: (error: any, actions: TActions) => Observable<any>
    intent?: (sources: any) => TActions
    model?: (actions: TActions) => Observable<TModel>
    teeth?: GearTeeth<TModel>
}

export type Transmission = ((sources: any) => Observable<Gear<any, any>>) | Observable<Gear<any, any>>

export interface PedalOptions {
    defaultGear?: Gear<any, any>
    defaultFilter?: (model: any) => boolean
    sinkMap?: Map<string, string>
}

export function pedal(transmission: Transmission, {
    defaultGear = { intent: () => ({}), model: () => xs.of({}), teeth: {} as GearTeeth<any> },
    defaultFilter = () => true,
    sinkMap = new Map()
}: PedalOptions = {}) {
    const defaultCatch = defaultGear.catch || ((error: any) => xs.throw(error))
    const defaultIntent = defaultGear.intent || (() => ({}))
    const defaultModel = defaultGear.model || (() => xs.of({}))

    // Fully expand tooth defaults to avoid doing all the tests below every time
    const toothDefaults: { [name: string]: GearTooth<any> } = {}
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

    return (sources: any) => {
        let gear: Observable<Gear<any, any>>
        if (transmission instanceof Function) {
            gear = transmission(sources)
        } else {
            gear = transmission
        }

        const spin = xs.fromObservable<Gear<any, any>>(gear)
            .map(gear => {
                const actions = gear.intent ? gear.intent(sources) : defaultIntent(sources)
                const state = xs.fromObservable(gear.model ? gear.model(actions) : defaultModel(actions))
                    .replaceError((err: any) => xs.fromObservable(gear.catch ? gear.catch(err, actions) : defaultCatch(err, actions)))
                    .remember()
                const views = teeth.reduce((accum, tooth) => Object.assign(accum, {
                    [tooth]: state.filter(toothFilter(tooth, (gear.teeth || {})[tooth])).map(toothView(tooth, (gear.teeth || {})[tooth]))
                }),
                                           {})

                return views
            })
            .startWith(emptyTeeth)
            .remember()

        const sinks = teeth.reduce((accum, tooth) => Object.assign(accum, {
            [sinkMap.has(tooth) ? sinkMap.get(tooth) : tooth]: adapt(spin.map((views: any) => views[tooth]).flatten())
        }),
                                   {})

        return sinks
    }
}
