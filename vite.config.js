import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const certPath = path.resolve(__dirname, '.cert', 'cert.pfx')

let httpsOpts = undefined
try {
  if (fs.existsSync(certPath)) {
    httpsOpts = {
      pfx: fs.readFileSync(certPath),
      passphrase: 'password',
    }
  }
} catch (e) {
  // fall back to HTTP
}

export default defineConfig({
  plugins: [react()],
  server: { host: true, https: httpsOpts },
})
