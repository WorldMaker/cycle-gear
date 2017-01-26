import * as Rx from 'rx'

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
    catch?: (error: any) => Rx.Observable<any>
    intent?: (sources: any) => TActions
    model?: (actions: TActions) => Rx.Observable<TModel>
    teeth?: GearTeeth<TModel>
}

export type Transmission = ((sources: any) => Rx.Observable<Gear<any, any>>) | Rx.Observable<Gear<any, any>>

export interface PedalOptions {
    defaultGear?: Gear<any, any>
    defaultFilter?: (model: any) => boolean
    sinkMap?: Map<string, string>
}

export function pedal(transmission: Transmission, {
    defaultGear = { intent: (sources: any) => ({}), model: (actions: any) => Rx.Observable.just({}), teeth: {} as GearTeeth<any> },
    defaultFilter = (model: any) => true,
    sinkMap = new Map()
}: PedalOptions = {}) {
    let { catch: defaultCatch, intent: defaultIntent, model: defaultModel } = defaultGear
    defaultCatch = defaultCatch || ((error: any) => Rx.Observable.throw(error))
    defaultIntent = defaultIntent || ((sources: any) => ({}))
    defaultModel = defaultModel || ((actions: any) => Rx.Observable.just({}).delay(300)) // TODO: Why does this delay work?

    // Fully expand tooth defaults to avoid doing all the tests below every time
    const teeth = Object.keys(defaultGear.teeth)
    const toothDefaults: { [name: string]: GearTooth<any> } = {}
    const emptyTeeth = teeth.reduce((accum, cur) => Object.assign(accum, { [cur]: Rx.Observable.never() }), {})
    for (let tooth of teeth) {
        const defGearTooth = defaultGear.teeth[tooth]
        if (defGearTooth instanceof Function) {
            toothDefaults[tooth] = { filter: defaultFilter, view: defGearTooth }
        } else {
            toothDefaults[tooth] = { filter: (defGearTooth as GearTooth<any>).filter || defaultFilter, view: (defGearTooth as GearTooth<any>).view }
        }
    }

    // Filter helper
    const toothFilter = (name: string, tooth: GearTooth<any> | GearView<any>) => {
        if (!tooth || tooth instanceof Function) {
            return toothDefaults[name].filter
        } else {
            return (tooth as GearTooth<any>).filter || toothDefaults[name].filter
        }
    }

    // View helper
    const toothView = (name: string, tooth: GearTooth<any> | GearView<any>) => {
        if (!tooth) {
            return toothDefaults[name].view
        } else if (tooth instanceof Function) {
            return tooth
        } else {
            return (tooth as GearTooth<any>).view
        }
    }

    return (sources: any) => {
        let gear$: Rx.Observable<Gear<any, any>>
        if (transmission instanceof Function) {
            gear$ = transmission(sources)
        } else {
            gear$ = transmission as Rx.Observable<Gear<any, any>>
        }

        const spin$ = gear$.map(gear => {
            const actions = gear.intent ? gear.intent(sources) : defaultIntent(sources)
            const state$ = (gear.model ? gear.model(actions) : defaultModel(sources))
                .catch(gear.catch ? gear.catch : defaultCatch)
                .shareReplay(1)
            const views = teeth.reduce((accum, tooth) => Object.assign(accum, {
                [tooth]: state$.filter(toothFilter(tooth, gear.teeth[tooth])).map(toothView(tooth, gear.teeth[tooth]))
            }),
                                       {})

            return views
        }).shareValue(emptyTeeth)

        const sinks = teeth.reduce((accum, tooth) => Object.assign(accum, {
            [sinkMap.has(tooth) ? sinkMap.get(tooth) : tooth]: spin$.flatMapLatest((views: any) => views[tooth])
        }),
                                   {})

        return sinks
    }
}
