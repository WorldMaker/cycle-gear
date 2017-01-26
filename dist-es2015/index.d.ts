import * as Rx from 'rx';
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
    catch?: (error: any) => Rx.Observable<any>;
    intent?: (sources: any) => TActions;
    model?: (actions: TActions) => Rx.Observable<TModel>;
    teeth?: GearTeeth<TModel>;
}
export declare type Transmission = ((sources: any) => Rx.Observable<Gear<any, any>>) | Rx.Observable<Gear<any, any>>;
export interface PedalOptions {
    defaultGear?: Gear<any, any>;
    defaultFilter?: (model: any) => boolean;
    sinkMap?: Map<string, string>;
}
export declare function pedal(transmission: Transmission, {defaultGear, defaultFilter, sinkMap}?: PedalOptions): (sources: any) => {};
