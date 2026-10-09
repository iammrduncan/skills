# Memory claim

Our model uses 8 bytes on the device, according to [the result](result.md).
The result comes from four weights multiplied by two bytes. The printed example
uses `weights = [1, 2, 3, 4]` and prints `len(weights) * 2` as `16`.
