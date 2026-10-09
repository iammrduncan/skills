# Selected principles

Prefer bounded work and tests of invalid input. Static startup allocation and two assertions per
function suit our embedded prototype; the service worker has a dynamic job set, so retain its
existing queue bound without importing the embedded allocation rule.
Use `ceiling:` for intentional shortcuts. The owner chose this marker.
