//import { createRequire } from "module";
//const require = createRequire(import.meta.url);
const { S3Client, AbortMultipartUploadCommand, PutObjectCommand } = require("@aws-sdk/client-s3");

const pg = require('pg');

const pool = new pg.Pool({
  max: 10, // default
  connectionString: process.env.DATABASE,
  ssl: {
    rejectUnauthorized: false
  }
})

async function feedburner(fid) {

  let poll = await getPoll(fid)

  let pollOutline = await getPollOutline(poll[0].pollOutlineId)

  let feed = await count_votes(fid)

  let tally = tallyVotes(feed)

  let showCount = poll[0].showCountOnGenerateFeed

  const results = pollOutline[0].docsdata.map((d) => {
    const item = showCount
      ? { id: null, pollId: null, votes: 0 }
      : { id: null, pollId: null };

    Object.keys(d).forEach((k) => {
      item[k] = d[k];
    });

    if (showCount) {
      item.votes = tally[d.id] || 0;
    }
    item.pollId = pollOutline[0].id;

    return item;
  });

  let excludes = poll[0].excludeItems.split(",")

  excludes = excludes.map(d => +d)

  let round = results.filter((result) => {
    return excludes.indexOf(+result.id) === -1;
  });

  console.log(`Round: ${round.length} birds`)

  generateAndUploadFeed(
    pollOutline[0],
    poll[0],
    round,
  )

}

const query = async (sql, params = []) => pool.query(sql, params)

async function count_votes(id) {
  const sql = `
  select * from vote where "pollId" = $1;`
  const { rows } = await query(sql, [id])
  return rows
}

async function getPoll(id) {
  const sql = `
  select * from poll where "id" = $1;`
  const { rows } = await query(sql, [id])
  return rows
}

async function getPollOutline(id) {
  const sql = `
  select * from poll_outline where "id" = $1;`
  const { rows } = await query(sql, [id])
  return rows
}

const tallyVotes = (votes) => {
    const tally = {};
    votes.forEach((v) => {
        const data = v.voteData;
        const id = data.id;
        if (tally[id]) {
            tally[id] += 1;
        }
        else {
            tally[id] = 1;
        }
    });
    return tally;
};

const generateAndUploadFeed = async (
  pollOutline,
  poll,
  data,
) => {
  const API_ROOT =  "https://pollarama-be-v2.herokuapp.com"

  const key = poll.key;

  const feed = {
    id: poll.id,
    name: pollOutline.name,
    type: pollOutline.type,
    template: pollOutline.template,
    start: poll.start,
    end: poll.end,
    status: poll.status,
    voteApiRoot: API_ROOT,
    data,
    hasVoteCount: poll.showCountOnGenerateFeed,
    lastModified: new Date(),
  };

  await uploadFeedToS3(`firehose/${poll.key}`, feed)

}

async function uploadFeedToS3(key, feed) {

  const client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
  });

  const command = new PutObjectCommand({
    Bucket: "gdn-cdn",
    Key: key,
    Body: JSON.stringify(feed),
    ContentType: `application/json`,
    ACL:'public-read',
    CacheControl: 'no-store, max-age=0',
  });

  try {
    const response = await client.send(command);
    //console.log(response);
    console.log(`https://interactive.guim.co.uk/${key}`);
  } catch (err) {
    console.error(err);
  }

};

feedburner(process.argv[2])