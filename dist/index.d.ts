import { Observable } from 'xstream';
export interface GearView<TModel> {
    (model: TModel): any;
}
export interface GearTooth<TModel> {
    filter?: (model: TModel) => boolean;
    view: GearView<TModel>;
}
export interface GearTeeth<TModel> {
    [name: string]: GearTooth<TModel> | GearView<TModel>;
}
export interface Gear<TActions, TModel> {
    name?: string;
    catch?: (error: any, actions: TActions) => Observable<any>;
    intent?: (sources: any) => TActions;
    model?: (actions: TActions) => Observable<TModel>;
    teeth?: GearTeeth<TModel>;
}
export declare type ToothReduce<TActions, TModel, TTooth, TAccumulator> = (accumulator: TAccumulator, current: [TTooth, Gear<TActions, TModel>]) => TAccumulator;
export interface ToothConnector<TActions, TModel, TTooth, TAccumulator> {
    fold?: boolean;
    reduce?: ToothReduce<TActions, TModel, TTooth, TAccumulator>;
    init?: () => TAccumulator;
    isolate?: (sources: any, sink: Observable<any>, gear: Gear<TActions, TModel>) => Observable<any>;
}
export declare type Transmission = ((sources: any) => Observable<Gear<any, any>>) | Observable<Gear<any, any>>;
export declare type Gearbox = ((sources: any) => Observable<Iterable<Gear<any, any>>>) | Observable<Iterable<Gear<any, any>>>;
export interface PedalOptions {
    defaultGear?: Gear<any, any>;
    defaultFilter?: (model: any) => boolean;
    sinkMap?: Map<string, string>;
}
export interface MotorOptions extends PedalOptions {
    sourcesWrapper?: (sources: any, gear: Gear<any, any>) => any;
    defaultConnector?: ToothConnector<any, any, any, any>;
    connectors?: Map<string, ToothConnector<any, any, any, any>>;
}
export declare function pedal(transmission: Transmission, {defaultGear, defaultFilter, sinkMap}?: PedalOptions): (sources: any) => {};
export declare function motor(gearbox: Gearbox, {defaultGear, defaultFilter, defaultConnector, sourcesWrapper, connectors, sinkMap}?: MotorOptions): (sources: any) => {};
