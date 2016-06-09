# cycle-gear

`cycle-gear` is a formalization of the [CycleJS MVI pattern](http://cycle.js.org/model-view-intent.html)
and a main function factory (`pedal`) to make use of the pattern.

## Why Formalize?

Cycle's documentation on the [CycleJS MVI pattern](http://cycle.js.org/model-view-intent.html)
makes it clear that Cycle's goal is not to formalize the MVI pattern into the framework.

Formalizing an architecture pattern, however, can provide a common component platform and
organization scheme to a project. `cycle-gear` is one approach to componentizing the pieces
of a CycleJS main component into a form encouraging separation of concerns, and easy reuse of
the component parts.

## The Pattern

![Gear Analogy](docs/images/gear-analogy.png)

A `Gear` consists of an `intent`, `model`, and a set of `teeth` comprising of a `filter`
and a `view`.

The `intent` responds to the changes from the gear's sources, converting them into actions
for a `model` to respond to.

The `model` takes the actions of the gear's `intent` and produces a single observable of
model states.

A `tooth` produces output to a gear's sinks by `filter`ing the gear's model states and
presenting them through a `view`.

## `pedal`

`pedal` is a main factory function for the `Gear` pattern. It takes a `transmission` of
Gears, default states for gears, which teeth to bind to which sinks, and from that
builds a Cycle main to wire the gears up to Cycle sources and sinks.

A `transmission` is an observable of gears or a factory from Cycle sources to an observable
of gears. At the top level of an application might be a `transmission` defined by a history
router such as [@cycle/history](https://github.com/cyclejs/history), and at lower levels a
`transmission` might be some other sort of user-action dependent state machine.  