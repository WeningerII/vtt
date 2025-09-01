import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * Performance-optimized Vite configuration for VTT client
 * Enhanced bundle splitting and optimization strategies
 */
export default defineConfig({
  plugins: [
    react({
      // Enable React Fast Refresh with better error boundaries
      fastRefresh: true,
      // Optimize JSX transform
      jsxRuntime: 'automatic'
    })
  ],
  
  build: {
    // Target modern browsers for better performance
    target: 'es2020',
    
    // Optimize chunks for better caching and loading
    rollupOptions: {
      output: {
        // Manual chunk splitting for optimal loading
        manualChunks: {
          // React ecosystem - likely to change less frequently
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          
          // UI libraries - stable dependencies
          'vendor-ui': ['lucide-react', 'framer-motion', 'clsx', 'tailwind-merge'],
          
          // VTT core - game-specific functionality
          'vtt-core': ['pixi.js', 'pixi-viewport'],
          
          // Utils - small, stable utilities
          'vendor-utils': ['date-fns', 'dompurify', 'usehooks-ts', 'i18next', 'react-i18next']
        },
        
        // Optimize chunk names for better caching
        chunkFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'vendor-react') return 'assets/vendor-react-[hash].js';
          if (chunkInfo.name === 'vendor-ui') return 'assets/vendor-ui-[hash].js'; 
          if (chunkInfo.name === 'vtt-core') return 'assets/vtt-core-[hash].js';
          if (chunkInfo.name === 'vendor-utils') return 'assets/vendor-utils-[hash].js';
          return 'assets/[name]-[hash].js';
        },
        
        // Optimize entry chunk
        entryFileNames: 'assets/main-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      },
      
      // External dependencies (if using CDN)
      external: (id) => {
        // Keep all dependencies bundled for now - can externalize later if needed
        return false;
      }
    },
    
    // Optimize bundle size
    minify: 'terser',
    terserOptions: {
      compress: {
        // Remove console.log in production
        drop_console: true,
        drop_debugger: true,
        // Optimize for size
        passes: 2
      },
      mangle: {
        // Keep class names for React DevTools
        keep_classnames: true,
        keep_fnames: false
      }
    },
    
    // Source maps for debugging (disable in production for smaller bundles)
    sourcemap: false,
    
    // Warn on large chunks (>500KB)
    chunkSizeWarningLimit: 500
  },
  
  // Development optimizations
  server: {
    // Enable HMR for faster development
    hmr: true,
    
    // Optimize deps prebundling
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'lucide-react',
        'framer-motion',
        'pixi.js',
        'pixi-viewport'
      ],
      // Exclude dependencies that don't need prebundling
      exclude: ['@vtt/core-schemas']
    }
  },
  
  // Path resolution
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@utils': resolve(__dirname, './src/lib'),
      '@hooks': resolve(__dirname, './src/hooks'),
      '@types': resolve(__dirname, './src/types')
    }
  },
  
  // Define build-time constants
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __VERSION__: JSON.stringify(process.env.npm_package_version || '0.0.0')
  },
  
  // CSS optimization
  css: {
    devSourcemap: false,
    // PostCSS configuration would go here if needed
  }
});
