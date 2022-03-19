import o_asciify from 'asciify'

export const asciify = function (message, options: AsciifyOptions) {
  return new Promise((resolve, reject) => {
    o_asciify(message, options, function (_err, res) {
      if (_err) {
        reject(_err)
      } else {
        console.log(res)
        resolve(null)
      }
    })
  })
}
