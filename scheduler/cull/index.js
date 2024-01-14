const fetch = require('node-fetch');
const timer = ms => new Promise(res => setTimeout(res, ms)) 
const pg = require('pg');

const pool = new pg.Pool({
  max: 10, // default
  connectionString: process.env.DATABASE,
  ssl: {
    rejectUnauthorized: false
  }
})

let blacklist = []

const query = async (sql, params = []) => pool.query(sql, params)

async function feedburner(cid) {

  let analysis = []

  let tokens = []

  let invalidate = []

  const googleKey = '1SSQw2yjRQllIZo-Db0vjxkrk63JG9hVJN3r_1SVJz-U';

  const id = cid

  let birds = await fetch(`https://interactive.guim.co.uk/docsdata/${googleKey}.json`).then(res => res.json())

  const birdName = new Map(birds.sheets.Sheet1.map(d => {
    return [+d.id, d.name]
  }))

  const voters = await getVoters(id)

  console.log(`Number of voters: ${voters.length}`)

  const votes = await getVotes(id)

  console.log(`Number of votes: ${votes.length}`)

  tokens = await getTokens(id)

  let duplicates = await getDuplicates(id)

  for await (const duplicate of duplicates) {

    tokens.push(duplicate)

  }

  for await (const vote of votes) {

    let obj = {}

    console.log(vote.id)
    
    obj.voteId = +vote.voterId

    obj.birdId = +vote.voteData.id

    obj.bird = birdName.get(+vote.voteData.id)

    obj.voted = vote.votedOn

    obj.status = vote.voteType

    let target = voters.find(d => d.id === vote.voterId)

    if (target) {

      let fingerprint = target.browserFingerprint

      obj.voterId = fingerprint

      let info = tokens.find(d => d.id === fingerprint)

      if (!info) {

        console.log(`Missing info`)

        console.log(obj.bird)

        let resp = await invalidateVote(obj.voteId)

      } else {

        let ip = info.ip 

        if (contains(blacklist, ip)) {

          console.log(`Removing blocked IP address: ${ip}`)

          invalidate.push(ip)

        }

        obj.ip = ip

        obj.ref = (info) ? info.ref : "" ;

        obj.browserFingerprint = (info) ? info.uid : "" ;

        obj.serverFingerprint = (info) ? info.serverfingerprint : "" ;

        obj.tokenCreated = (info) ? info.created : "" ;

        obj.platform = (info) ? info.profile.platform : "" ;

        if (info.profile.server) {

          obj.country = info.profile.server.geoip.country

          obj.serverView = `${info.profile.server.useragent.device.family} | ${info.profile.server.useragent.browser.family}`

        } else {

          obj.country = ""

          obj.serverView = ""

        }

        if (info) {
          obj.device = (info.profile.app.isIos || info.profile.isMobile) ? true : false
        } else {
          obj.device = ""
        }

      }

    } else {

      //let resp = await invalidateVote(obj.voteId)

      console.log(`Missing file... ${obj.bird}`)

    }

    analysis.push(obj)

  }

  var grouped = analysis.reduce((x, y) => {

    (x[y.ip] = x[y.ip] || []).push(y);

    return x;

  }, {});

  let groups = Object.keys(grouped)

  let special = []

  for await (const group of groups) {

    let voteCount = grouped[group].length

    var count = grouped[group].reduce((x, y) => {

      (x[y.bird] = x[y.bird] || []).push(y);

      return x;

    }, {});

    let uniques = Object.keys(count)

    if (voteCount > 10 && uniques.length > 1) {

      let parent = {}

      parent.ip = group

      parent.family = []

      parent.total = 0

      for await (const bird of uniques) {

        let obj = {}

        obj.bird = bird

        obj.count = count[bird].length

        parent.total = parent.total + count[bird].length

        parent.family.push(obj)

      }

      special.push(parent)

    }

    if (voteCount > 10 && uniques.length == 1) {

      invalidate.push(group)

      console.log(`${group} - ${uniques[0]}: ${voteCount}`)

    }

    //await timer(2000)

  }


  for await (const sam of special) {

    if (sam.family.length > 1) {

        let range = sam.family.map(d => d.count)

        let max = Math.max(...range)

        let percentage = 100 / sam.total * max

        if (percentage > 60 && percentage <= 90) {

            console.log(percentage)

            console.log(sam)

        }

        if (percentage > 90) {

            console.log(percentage)

            console.log(sam)

            invalidate.push(sam.ip)

        }

    }

  }

  for await (const invalid of invalidate) {

    let targets = analysis.filter(d => d.ip === invalid)

    for await (const target of targets) {

      let resp = await invalidateVote(target.voteId)

      console.log(`Removing fraudulent bird: ${target.bird}`)

    }

  }

  console.log("Completed cull")

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


async function invalidateVote(id) {
  const sql = `
  UPDATE vote SET "voteType" = 'BLOCKED' WHERE "voterId" = $1`
  const { rowCount } = await query(sql, [id])
  return rowCount
}


async function getDuplicates(id) {
  const sql = `
  select * from duplicates where "cid" = $1;`
  const { rows } = await query(sql, [id])
  return rows
}

async function getTokens(id) {
  const sql = `
  select * from tokens where "cid" = $1;`
  const { rows } = await query(sql, [id])
  return rows
}


async function getVoters(id) {
  const sql = `
  select * from voter where "pollId" = $1;`
  const { rows } = await query(sql, [id])
  return rows
}

async function getVotes(id) {
  const sql = `
  select * from vote where "pollId" = $1 AND "voteType" = $2;`
  const { rows } = await query(sql, [id, "VALID"])
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


function contains(a, b) {
    // array matches
    if (Array.isArray(b)) {
        return b.some(x => a.indexOf(x) > -1);
    }
    // string match
    return a.indexOf(b) > -1;
}


feedburner(process.argv[2])
