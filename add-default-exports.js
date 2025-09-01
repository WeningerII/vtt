const fs = require('fs');
const path = require('path');

// List of components that need default exports added
const componentsToFix = [
  { file: 'apps/client/src/components/map/BattleMap.tsx', name: 'BattleMap' },
  { file: 'apps/client/src/components/map/TokenPropertiesPanel.tsx', name: 'TokenPropertiesPanel' },
  { file: 'apps/client/src/components/map/MapLayersPanel.tsx', name: 'MapLayersPanel' },
  { file: 'apps/client/src/components/MonsterBrowser.tsx', name: 'MonsterBrowser' },
  { file: 'apps/client/src/components/CharacterSheet.tsx', name: 'CharacterSheet' },
  { file: 'apps/client/src/components/GameCanvas.tsx', name: 'GameCanvas' },
  { file: 'apps/client/src/components/MapEditor.tsx', name: 'MapEditor' },
  { file: 'apps/client/src/components/EncounterGenerator.tsx', name: 'EncounterGenerator' },
  { file: 'apps/client/src/components/AIAssistant.tsx', name: 'AIAssistant' },
  { file: 'apps/client/src/components/CombatTracker.tsx', name: 'CombatTracker' },
  { file: 'apps/client/src/components/DiceRoller.tsx', name: 'DiceRoller' },
  { file: 'apps/client/src/components/campaigns/CampaignsList.tsx', name: 'CampaignsList' },
  { file: 'apps/client/src/components/campaigns/CreateCampaignModal.tsx', name: 'CreateCampaignModal' },
  { file: 'apps/client/src/components/campaigns/CampaignMapManager.tsx', name: 'CampaignMapManager' },
  { file: 'apps/client/src/components/auth/LoginForm.tsx', name: 'LoginForm' },
  { file: 'apps/client/src/components/auth/RegisterForm.tsx', name: 'RegisterForm' },
  { file: 'apps/client/src/components/dashboard/DashboardHome.tsx', name: 'DashboardHome' },
  { file: 'apps/client/src/components/billing/BillingDashboard.tsx', name: 'BillingDashboard' },
  { file: 'apps/client/src/components/character/AbilityScores.tsx', name: 'AbilityScores' },
  { file: 'apps/client/src/components/character/EquipmentPanel.tsx', name: 'EquipmentPanel' },
  { file: 'apps/client/src/components/character/SpellsPanel.tsx', name: 'SpellsPanel' },
  { file: 'apps/client/src/components/character/SkillsPanel.tsx', name: 'SkillsPanel' },
  { file: 'apps/client/src/components/character/NotesPanel.tsx', name: 'NotesPanel' },
  { file: 'apps/client/src/components/combat/CombatEncounterPanel.tsx', name: 'CombatEncounterPanel' },
  { file: 'apps/client/src/components/ai/CombatAssistant.tsx', name: 'CombatAssistant' },
  { file: 'apps/client/src/components/ai/GenesisWizard.tsx', name: 'GenesisWizard' },
  { file: 'apps/client/src/components/PerformanceMonitor.tsx', name: 'PerformanceMonitor' },
  { file: 'apps/client/src/components/VTTApp.tsx', name: 'VTTApp' },
  { file: 'apps/client/src/components/SceneCanvas.tsx', name: 'SceneCanvas' },
  { file: 'apps/client/src/components/GameLobby.tsx', name: 'GameLobby' },
  { file: 'apps/client/src/components/VTTDemo.tsx', name: 'VTTDemo' }
];

let fixedCount = 0;
let alreadyHasDefault = 0;
let notFound = 0;

componentsToFix.forEach(({ file, name }) => {
  const filePath = path.join(__dirname, file);
  
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${file}`);
      notFound++;
      return;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if default export already exists
    if (content.includes(`export default ${name}`) || content.includes(`export { ${name} as default }`)) {
      console.log(`✓ Already has default export: ${file}`);
      alreadyHasDefault++;
      return;
    }
    
    // Add default export at the end of the file
    // Remove trailing whitespace and add the export
    content = content.trimEnd() + '\n\nexport default ' + name + ';\n';
    
    fs.writeFileSync(filePath, content);
    console.log(`✓ Added default export to: ${file}`);
    fixedCount++;
  } catch (error) {
    console.error(`Error processing ${file}:`, error.message);
  }
});

console.log('\n=== Summary ===');
console.log(`Fixed: ${fixedCount} files`);
console.log(`Already had default export: ${alreadyHasDefault} files`);
console.log(`Not found: ${notFound} files`);
console.log(`Total processed: ${componentsToFix.length} files`);
