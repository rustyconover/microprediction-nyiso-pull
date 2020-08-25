// What this code does is download the latest load information and publishes to microprediction.org
import { MicroWriter, MicroWriterConfig, MicroReader } from "microprediction";
import { write_keys } from "./write-keys";
const bent = require("bent");

const get = bent("GET", 200);
const parse = require("csv-parse/lib/sync");
import * as _ from "lodash";
import { ScheduledHandler } from "aws-lambda";
import moment from "moment-timezone";

export const handler: ScheduledHandler<any> = async (event) => {
  console.log("Fetching data");
  const now = moment().tz("America/New_York").format("YYYYMMDD");
  console.log(now);

  // Its important to use the current date in UTC because that's how the data
  // is stored.
  //
  // The file is updated every five minutes.
  const request = await get(
    `http://mis.nyiso.com/public/csv/pal/${now}pal.csv`
  );

  // Pull back the text body.
  const contents = await request.text();

  // Parse the CSV returned - load is returned in megawatts
  const records: Array<{
    "Time Stamp": string;
    "Time Zone": string;
    Name: string;
    PTID: string;
    Load: string | undefined;
  }> = parse(contents, {
    columns: true,
    skip_empty_lines: true,
  });

  // Only deal with records that have a specified load value, the file
  // can have empty lines.
  const good_records = records.filter((v) => v.Load !== "");

  const dates = _.groupBy(good_records, "Time Stamp");
  // Just get the last timestamp.
  const last_time_with_loads: string = Object.keys(dates).sort().reverse()[0];

  console.log(last_time_with_loads);
  let total = 0;
  let write_counter = 0;

  // Accumulate all of the write promises so parallelism can be used.
  const writes = [];

  // Loop over the records with the last timestamp and push them to the stream.
  for (const { Name, Load } of dates[last_time_with_loads]) {
    let config = await MicroWriterConfig.create({
      write_key: write_keys[write_counter++],
    });
    const writer = new MicroWriter(config);

    if (Load == null) {
      continue;
    }
    const load = parseFloat(Load);
    const pretty_name = Name.toLowerCase()
      .replace(" ", "_")
      .replace(/\./g, "")
      .replace("_vl", "_valley");

    console.log(pretty_name, load);
    writes.push(writer.set(`electricity-load-nyiso-${pretty_name}.json`, load));
    total += load;
  }

  console.log("Overall load", total);
  {
    let config = await MicroWriterConfig.create({
      write_key: write_keys[write_counter++],
    });
    const writer = new MicroWriter(config);
    writes.push(writer.set(`electricity-load-nyiso-overall.json`, total));
  }

  // Wait for all of the writes to finish.
  await Promise.all(writes);
};
