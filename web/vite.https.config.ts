import { defineConfig, mergeConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import base from './vite.config';

// `npm run dev:https` - serves https://<your-LAN-IP>:5173 with a self-signed
// certificate so a Meta Quest browser can use WebXR (needs a secure context).
// The Quest will show a certificate warning once; choose "Advanced > Proceed".
export default mergeConfig(base, defineConfig({ plugins: [basicSsl()] }));
