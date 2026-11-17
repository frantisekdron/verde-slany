import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({base:'/verde-slany/admin/',plugins:[react()],publicDir:'static',build:{outDir:'../admin',emptyOutDir:true,sourcemap:false}});
