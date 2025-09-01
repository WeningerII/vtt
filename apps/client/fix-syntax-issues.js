#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fix SceneCanvas.tsx syntax errors
function fixSceneCanvas() {
  const filePath = path.join(__dirname, 'src/components/SceneCanvas.tsx');
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix token.id syntax errors in type definitions
  content = content.replace(/token\.id:/g, 'tokenId:');
  content = content.replace(/_token\.id:/g, 'tokenId:');
  
  // Fix token.id in object literals
  content = content.replace(/token\.id:\s*token\.id/g, 'tokenId: token.id');
  
  // Fix parameter names
  content = content.replace(/\(_token\.id:\s*string\)/g, '(tokenId: string)');
  
  fs.writeFileSync(filePath, content);
  console.log('Fixed SceneCanvas.tsx');
}

// Fix CreateCampaignModal.tsx syntax errors
function fixCreateCampaignModal() {
  const filePath = path.join(__dirname, 'src/components/campaigns/CreateCampaignModal.tsx');
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix e.target.value={...} syntax errors
  // These should be value={...} onChange={(e) => ...}
  content = content.replace(
    /e\.target\.value=\{([^}]+)\}/g,
    'value={$1} onChange={(e) => handleInputChange("name", e.target.value)}'
  );
  
  // Fix specific patterns
  content = content.replace(
    /value=\{formData\.name\} onChange=\{\(e\) => handleInputChange\("name", e\.target\.value\)\}/g,
    'value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}'
  );
  
  content = content.replace(
    /value=\{formData\.system\.id\} onChange=\{\(e\) => handleInputChange\("name", e\.target\.value\)\}/g,
    'value={formData.system} onChange={(e) => setFormData({...formData, system: e.target.value})}'
  );
  
  content = content.replace(
    /value=\{formData\.description\} onChange=\{\(e\) => handleInputChange\("name", e\.target\.value\)\}/g,
    'value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})}'
  );
  
  content = content.replace(
    /value=\{formData\.maxPlayers\} onChange=\{\(e\) => handleInputChange\("name", e\.target\.value\)\}/g,
    'value={formData.maxPlayers} onChange={(e) => setFormData({...formData, maxPlayers: parseInt(e.target.value)})}'
  );
  
  // Fix opt.e.target.value
  content = content.replace(/opt\.e\.target\.value/g, 'opt.value');
  
  fs.writeFileSync(filePath, content);
  console.log('Fixed CreateCampaignModal.tsx');
}

// Fix MSW handlers duplicate async
function fixMswHandlers() {
  const filePath = path.join(__dirname, 'src/test-utils/msw-handlers.ts');
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove duplicate async keywords
  content = content.replace(/async\s+async/g, 'async');
  
  fs.writeFileSync(filePath, content);
  console.log('Fixed MSW handlers');
}

// Run all fixes
console.log('Fixing syntax issues...\n');

fixSceneCanvas();
fixCreateCampaignModal();
fixMswHandlers();

console.log('\nSyntax issues fixed!');
