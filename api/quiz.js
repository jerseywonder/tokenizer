const pg = require('pg');

const pool = new pg.Pool({
  max: 10, // default
  connectionString: process.env.DATABASE,
  ssl: {
    rejectUnauthorized: false
  }
})

const query = async (sql, params = []) => pool.query(sql, params)

async function postresults(values) {
  const sql = `
  INSERT INTO worse (q1, q1j, q1r, q2, q2j, q2r, q3, q3j, q3r, q4, q4j, q4r, q5, q5j, q5r, q6, q6j, q6r, q7, q7j, q7r, q8, q8j, q8r, q9, q9j, q9r, q10, q10j, q10r) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30) returning id;`
  const { rows } = await query(sql, values)
  return rows[0].id
}

module.exports = async function quiz(req, res, next) {

    const data = req.body; 

    try {

        if (data.worst) {

            const worst = data.worst.map(d => {
                return { a : d.correct, b : JSON.stringify(d.data),  c : d.rmse }
            })

            const flattenedArray = worst.map(obj => Object.values(obj)).flat();

            let id = await postresults(flattenedArray)

        }

    } catch (err) {

        console.log(err)

    } finally {

        res.json({ status: 69 })

    }

}