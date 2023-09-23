const pg = require('pg');

const pool = new pg.Pool({
  max: 10, // default
  connectionString: process.env.DATABASE,
  ssl: {
    rejectUnauthorized: false
  }
})

const active = process.env.POLLS

var ipblock = process.env.ipblock

module.exports = async function token(req, res, next) {
    
    const data = req.body; 

    let token = "c3P0r2D2ca062da0e3a9892c500e05cf"

    try {

        if (req.fingerprint && data.uid && data.key && data.cid) {

            const browserFingerprint = data.uid; // Browser fingerprint

            const key = data.key; // Googledoc key

            const cid = data.cid; // Competition ID

            const profile = data.profile  // Profile info
            
            const serverFingerprint = req.fingerprint.hash; // Server side fingerprint

            const referer = req.headers.referer; // ref.indexOf("https://www.theguardian.com/" does not work in the apps
        
            const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress; // ip address

            //const ipToInt32 = (ip) => ip.split`.`.reduce((r, e) => r * 256 + +e);

            //let ipo = ipToInt32(ip)

            //ipo = ipo.toString();

            let count = await count_token([cid, browserFingerprint, ip])

            if (count == 0) {

                token = await get_token([cid, key, browserFingerprint, ip, referer, JSON.stringify(profile), serverFingerprint])

                console.log('Generate new token')

            } else {

                let current = await get_id([cid, browserFingerprint, ip])

                token = await existential([cid, key, browserFingerprint, ip, referer, JSON.stringify(profile), serverFingerprint, current])

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