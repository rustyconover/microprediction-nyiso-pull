# Import NYISO Electricity Loads to Microprediction

This module is an example use of the [microprediction](https://www.npmjs.com/package/microprediction) module
to import data from the NYISO into the microprediction.org prediction platform.

## Loaded Data

The data is currently loaded from the [NYISO](https://www.nyiso.com/) for
electrical load in megawatts for these zones.

- CAPITL
- CENTRL
- DUNWOD
- GENESE
- HUD VL
- LONGIL
- MHK VL
- MILLWD
- N.Y.C.
- NORTH
- WEST

Additionally there is a stream created for the overall load which is the sum
of all of the zones' loads.

## Implementation Details

There is a single Lambda function that is run as a scheduled
CloudWatch Event every five minutes to push new data. This function
is created using webpack to amalgamate the various imported modules.

It runs in about 2 seconds or less every five minutes.

The write keys are not included in this repo.
