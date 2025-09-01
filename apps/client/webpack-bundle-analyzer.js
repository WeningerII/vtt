#!/usr/bin/env node

/**
 * Bundle Analyzer - Analyze webpack bundle size and composition
 * Usage: node webpack-bundle-analyzer.js [--interactive]
 */

const fs = require('fs');
const path = require('path');

// Simple bundle size analyzer
class BundleAnalyzer {
  constructor() {
    this.results = {
      totalSize: 0,
      chunks: [],
      dependencies: new Map(),
      recommendations: []
    };
  }

  async analyzeBuild(buildDir = 'dist') {
    const buildPath = path.resolve(buildDir);
    
    if (!fs.existsSync(buildPath)) {
      console.log('❌ Build directory not found. Run "npm run build" first.');
      return;
    }

    console.log('🔍 Analyzing bundle...\n');

    // Analyze JS files
    await this.analyzeJSFiles(buildPath);
    
    // Analyze CSS files  
    await this.analyzeCSSFiles(buildPath);
    
    // Generate recommendations
    this.generateRecommendations();
    
    // Output results
    this.printResults();
  }

  async analyzeJSFiles(buildPath) {
    const jsFiles = this.findFiles(buildPath, '.js');
    
    for (const file of jsFiles) {
      const stats = fs.statSync(file);
      const content = fs.readFileSync(file, 'utf8');
      
      const chunk = {
        name: path.relative(buildPath, file),
        size: stats.size,
        gzipEstimate: Math.round(stats.size * 0.3), // Rough gzip estimate
        type: 'js'
      };

      // Detect large dependencies
      this.detectDependencies(content, chunk.name);
      
      this.results.chunks.push(chunk);
      this.results.totalSize += stats.size;
    }
  }

  async analyzeCSSFiles(buildPath) {
    const cssFiles = this.findFiles(buildPath, '.css');
    
    for (const file of cssFiles) {
      const stats = fs.statSync(file);
      
      const chunk = {
        name: path.relative(buildPath, file),
        size: stats.size,
        gzipEstimate: Math.round(stats.size * 0.4), // CSS compresses better
        type: 'css'
      };
      
      this.results.chunks.push(chunk);
      this.results.totalSize += stats.size;
    }
  }

  detectDependencies(content, filename) {
    // Look for large dependency patterns
    const patterns = [
      { name: 'lucide-react', pattern: /lucide-react/g, type: 'icons' },
      { name: 'react-dom', pattern: /react-dom/g, type: 'framework' },
      { name: 'framer-motion', pattern: /framer-motion/g, type: 'animation' },
      { name: 'pixi.js', pattern: /pixi\.js|PIXI/g, type: 'graphics' },
      { name: 'date-fns', pattern: /date-fns/g, type: 'utility' }
    ];

    for (const { name, pattern, type } of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        if (!this.results.dependencies.has(name)) {
          this.results.dependencies.set(name, { count: 0, files: [], type });
        }
        const dep = this.results.dependencies.get(name);
        dep.count += matches.length;
        if (!dep.files.includes(filename)) {
          dep.files.push(filename);
        }
      }
    }
  }

  findFiles(dir, extension) {
    const files = [];
    
    function traverse(currentDir) {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          traverse(fullPath);
        } else if (item.endsWith(extension)) {
          files.push(fullPath);
        }
      }
    }
    
    traverse(dir);
    return files;
  }

  generateRecommendations() {
    const totalKB = Math.round(this.results.totalSize / 1024);
    
    // Size-based recommendations
    if (totalKB > 1500) {
      this.results.recommendations.push({
        type: 'warning',
        message: `Bundle size (${totalKB}KB) exceeds 1.5MB target. Consider code splitting.`
      });
    }

    // Large chunk recommendations
    const largeChunks = this.results.chunks.filter(chunk => chunk.size > 300000);
    if (largeChunks.length > 0) {
      this.results.recommendations.push({
        type: 'info',
        message: `Found ${largeChunks.length} chunks >300KB. Consider splitting: ${largeChunks.map(c => c.name).join(', ')}`
      });
    }

    // Dependency recommendations
    if (this.results.dependencies.has('lucide-react')) {
      const dep = this.results.dependencies.get('lucide-react');
      if (dep.files.length > 3) {
        this.results.recommendations.push({
          type: 'optimization',
          message: `lucide-react used in ${dep.files.length} files. Consider centralizing imports for better tree shaking.`
        });
      }
    }

    // Success message
    if (totalKB <= 1300) {
      this.results.recommendations.push({
        type: 'success',
        message: `Bundle size (${totalKB}KB) is within optimal range! 🎉`
      });
    }
  }

  printResults() {
    console.log('📊 Bundle Analysis Results\n');
    console.log('═'.repeat(50));
    
    // Total size
    const totalKB = Math.round(this.results.totalSize / 1024);
    const totalMB = (totalKB / 1024).toFixed(2);
    console.log(`📦 Total Bundle Size: ${totalKB}KB (${totalMB}MB)`);
    
    // Chunks breakdown
    console.log('\n📄 Chunks Breakdown:');
    this.results.chunks
      .sort((a, b) => b.size - a.size)
      .slice(0, 10)
      .forEach(chunk => {
        const kb = Math.round(chunk.size / 1024);
        const gzipKB = Math.round(chunk.gzipEstimate / 1024);
        const bar = '█'.repeat(Math.min(20, Math.round(kb / 50)));
        console.log(`  ${chunk.name.padEnd(25)} ${kb.toString().padStart(4)}KB (~${gzipKB}KB gzipped) ${bar}`);
      });

    // Dependencies
    if (this.results.dependencies.size > 0) {
      console.log('\n📚 Major Dependencies:');
      for (const [name, info] of this.results.dependencies) {
        console.log(`  ${name.padEnd(15)} - ${info.type.padEnd(10)} (${info.files.length} files)`);
      }
    }

    // Recommendations
    console.log('\n💡 Recommendations:');
    this.results.recommendations.forEach(rec => {
      const emoji = rec.type === 'success' ? '✅' : rec.type === 'warning' ? '⚠️' : rec.type === 'optimization' ? '🚀' : 'ℹ️';
      console.log(`  ${emoji} ${rec.message}`);
    });

    console.log('\n═'.repeat(50));
  }
}

// Run analyzer
const analyzer = new BundleAnalyzer();
analyzer.analyzeBuild('dist').catch(console.error);

module.exports = BundleAnalyzer;
