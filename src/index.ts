// What this code does is download the latest load information and publishes to microprediction.org
import { MicroWriter, MicroWriterConfig, MicroReader } from "microprediction";
import { write_keys } from "./write-keys";
const bent = require("bent");

const get = bent("GET", 200);
const parse = require("csv-parse/lib/sync");
import * as _ from "lodash";
import { CloudWatchLogsEvent, ScheduledHandler } from "aws-lambda";
import moment from "moment";

async function processData() {
  console.log("Fetching data");

  const now = moment().utc().format("YYYYMMDD");
  console.log(now);
  const request = await get(
    `http://mis.nyiso.com/public/csv/pal/${now}pal.csv`
  );
  const contents = await request.text();

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

  const good_records = records.filter((v) => v.Load !== "");
  //  console.log(JSON.stringify(good_records, null, 2));

  const dates = _.groupBy(good_records, "Time Stamp");
  const last_time_with_loads: string = Object.keys(dates).sort().reverse()[0];

  console.log(last_time_with_loads);
  let total = 0;
  let write_counter = 0;
  const writes = [];

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
  console.log("Overall");
  console.log(total);
  {
    let config = await MicroWriterConfig.create({
      write_key: write_keys[write_counter++],
    });
    const writer = new MicroWriter(config);
    writes.push(writer.set(`electricity-load-nyiso-overall.json`, total));
  }
  // Wait for all of the writes to finish.
  await Promise.all(writes);
}

export const handler: ScheduledHandler<any> = async (event) => {
  await processData();
};
