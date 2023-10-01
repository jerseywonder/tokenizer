const pg = require('pg');

const pool = new pg.Pool({
  max: 10, // default
  connectionString: process.env.DATABASE,
  ssl: {
    rejectUnauthorized: false
  }
})

const active = process.env.POLLS

var ipblock = ["58.96.14.27", "159.196.149.84", "110.32.202.166","124.47.163.185","121.200.35.2", "58.161.99.94","101.188.34.66","144.178.13.38","1.136.21.10","172.58.127.105","116.255.63.54","60.240.4.105","67.188.8.17","101.116.28.229","120.21.149.130","1.145.130.55","202.91.45.52"] //process.env.ipblock // "58.161.99.94","1.152.110.80"

module.exports = async function token(req, res, next) {
    
    const data = req.body; 

    let token = "c3P0r2D2ca062da0e3a9892c500e05cf"

    try {

        if (req.fingerprint && data.uid && data.key && data.cid && data.profile) { //  

            const browserFingerprint = broncage(data.uid); // Browser fingerprint

            const key = data.key; // Googledoc key

            const cid = data.cid; // Competition ID

            const suspect = {"app": {"isIos": false, "isiPad": false, "isiPhone": false, "isAndroid": false}, "isApp": false, "isMobile": false, "platform": "suspect", "userAgent": "suspect", "localstore": false, "screenWidth": 0, "screenHeight": 0}

            const profile = isJson(data.profile) ? data.profile : suspect

            if (!isJson(data.profile)) {

                profile.status = String(data.profile)

            }
            
            const serverFingerprint = broncage(req.fingerprint.hash); // Server side fingerprint

            const referer = broncage(req.headers.referer); // ref.indexOf("https://www.theguardian.com/" does not work in the apps
        
            let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress; // ip address

            //const ipToInt32 = (ip) => ip.split`.`.reduce((r, e) => r * 256 + +e);

            //let ipo = ipToInt32(ip)

            //ipo = ipo.toString();
            /*
              gkey varchar(255) COLLATE "pg_catalog"."default",
              uid varchar(255) COLLATE "pg_catalog"."default",
              ip varchar(255) COLLATE "pg_catalog"."default",
              ref varchar(255) COLLATE "pg_catalog"."default",
              serverFingerprint varchar(255) COLLATE "pg_catalog"."default",
              profile jsonb DEFAULT '{}'::jsonb,
            */

            profile.server = (req.fingerprint.components) ? req.fingerprint.components : [] ;

            let count = await count_token([cid, browserFingerprint, ip])

            if (count == 0) {

                token = await get_token([cid, key, browserFingerprint, ip, referer, JSON.stringify(profile), serverFingerprint])

                console.log('Generate new token')

            } else {

                let current = await get_id([cid, browserFingerprint, ip])

                if (!contains(ipblock, ip)) {

                    if (data.profile.app.isIos || data.profile.isMobile) {

                        profile.tagged = "mobile"

                        token = await existential([cid, key, browserFingerprint, ip, referer, JSON.stringify(profile), serverFingerprint, current])

                    } else {

                        token = current

                        profile.tagged = "Suspicious"

                        let bluff = await existential([cid, key, browserFingerprint, ip, referer, JSON.stringify(profile), serverFingerprint, current])

                    }

                } else {

                    token = current

                    profile.tagged = "Blocked"

                    let bluff = await existential([cid, key, browserFingerprint, ip, referer, JSON.stringify(profile), serverFingerprint, current])

                }



                /*

                token = await existential([cid, key, browserFingerprint, ip, referer, JSON.stringify(profile), serverFingerprint, current])

                if ( contains(ipblock, ip) && !data.profile.app.isIos) {

                    token = "c3P0r2D2ca062da0e3a9892c500e05cf"

                }

                */

                console.log('Insert into the duplicates table')

            }

        }

    } catch (err) {

        console.log(err)

        token = "c3P0r2D2ca062da0e3a9892c500e05cf"

    } finally {

        res.json({ status: 69, token : token })

    }

}

function isJson(str) {
  try {
      JSON.parse(str);
  } catch (e) {
      return false;
  }
  return true;
}

function broncage(str) {

    if (typeof str === 'string' || str instanceof String) {

        return (str.length > 255) ? str.substr(str, 254) : str

    } else {

        return String(str)

    }

}

function contains(a, b) {

    if (Array.isArray(b)) {
        return b.some(x => a.indexOf(x) > -1);
    }

    return a.indexOf(b) > -1;
}

const query = async (sql, params = []) => pool.query(sql, params)

async function get_token(values) {
  const sql = `
  INSERT INTO tokens(cid, gkey, uid, ip, ref, profile, serverFingerprint) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING tokens.id;`
  const { rows } = await query(sql, values)
  return rows[0].id
}

async function existential(values) {
  const sql = `
  INSERT INTO duplicates(cid, gkey, uid, ip, ref, profile, serverFingerprint, token) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING duplicates.id;`
  const { rows } = await query(sql, values)
  return rows[0].id
}

async function count_token(values) {
  const sql = `
  select count(*) from tokens where cid = $1 AND uid = $2 AND ip = $3;`
  const { rows } = await query(sql, values)
  return rows[0].count
}

async function get_id(values) {
  const sql = `
  select id from tokens where cid = $1 AND uid = $2 AND ip = $3`
  const { rows } = await query(sql, values)
  return rows[0].id
}