#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');

// Map of generic labels to context-specific replacements
const ariaLabelReplacements = {
  'aria-label="Button"': {
    'Try Again': 'aria-label="Try again after error"',
    'Join Campaign': 'aria-label="Join campaign"',
    'Retry': 'aria-label="Retry loading"',
    'Previous': 'aria-label="Go to previous page"',
    'Next': 'aria-label="Go to next page"',
    'End Combat': 'aria-label="End combat"',
    'Start Combat': 'aria-label="Start combat"',
    'Add Combatant': 'aria-label="Add combatant to encounter"',
    'Cancel': 'aria-label="Cancel action"',
    'Send': 'aria-label="Send message"',
    'Roll Dice': 'aria-label="Roll dice"',
    'Generate Encounter': 'aria-label="Generate encounter"',
    'Use This Encounter': 'aria-label="Use this encounter"',
    'Generate Another': 'aria-label="Generate another encounter"',
    'Create Encounter': 'aria-label="Create new encounter"',
    'Next Turn': 'aria-label="Go to next turn"',
    'Previous Turn': 'aria-label="Go to previous turn"',
    'Clear Filters': 'aria-label="Clear all filters"',
    'Add to Encounter': 'aria-label="Add monster to encounter"',
    'Login': 'aria-label="Login to account"',
    'Register': 'aria-label="Register new account"',
    'Save': 'aria-label="Save changes"',
    'Delete': 'aria-label="Delete item"',
    'Edit': 'aria-label="Edit item"',
    'Close': 'aria-label="Close dialog"',
    '×': 'aria-label="Close"',
    'Submit': 'aria-label="Submit form"',
    'Refresh': 'aria-label="Refresh data"',
    'Export': 'aria-label="Export data"',
    'Import': 'aria-label="Import data"',
    'Search': 'aria-label="Search"',
    'Filter': 'aria-label="Apply filters"',
    'Reset': 'aria-label="Reset to defaults"',
    'Upload': 'aria-label="Upload file"',
    'Download': 'aria-label="Download file"',
    'Copy': 'aria-label="Copy to clipboard"',
    'Paste': 'aria-label="Paste from clipboard"',
    'Undo': 'aria-label="Undo last action"',
    'Redo': 'aria-label="Redo last action"',
    'Help': 'aria-label="Show help"',
    'Settings': 'aria-label="Open settings"',
    'Profile': 'aria-label="View profile"',
    'Logout': 'aria-label="Logout from account"',
    'Add': 'aria-label="Add new item"',
    'Remove': 'aria-label="Remove item"',
    'Update': 'aria-label="Update item"',
    'Confirm': 'aria-label="Confirm action"',
    'Back': 'aria-label="Go back"',
    'Forward': 'aria-label="Go forward"',
    'Home': 'aria-label="Go to home"',
    'Menu': 'aria-label="Open menu"',
    'More': 'aria-label="Show more options"',
    'Less': 'aria-label="Show less options"',
    'Expand': 'aria-label="Expand section"',
    'Collapse': 'aria-label="Collapse section"',
    'Toggle': 'aria-label="Toggle option"',
    'Select': 'aria-label="Select item"',
    'Deselect': 'aria-label="Deselect item"',
    'Clear': 'aria-label="Clear selection"',
    'Apply': 'aria-label="Apply changes"',
    'Discard': 'aria-label="Discard changes"',
    'Continue': 'aria-label="Continue to next step"',
    'Skip': 'aria-label="Skip this step"',
    'Finish': 'aria-label="Finish process"',
    'Start': 'aria-label="Start process"',
    'Stop': 'aria-label="Stop process"',
    'Pause': 'aria-label="Pause process"',
    'Resume': 'aria-label="Resume process"',
    'Restart': 'aria-label="Restart process"'
  },
  'aria-label="Input field"': {
    'Search': 'aria-label="Search input"',
    'Email': 'aria-label="Email address"',
    'Password': 'aria-label="Password"',
    'Username': 'aria-label="Username"',
    'Name': 'aria-label="Name"',
    'Description': 'aria-label="Description"',
    'Title': 'aria-label="Title"',
    'Message': 'aria-label="Message input"',
    'Comment': 'aria-label="Comment input"',
    'Notes': 'aria-label="Notes input"',
    'Amount': 'aria-label="Amount input"',
    'Quantity': 'aria-label="Quantity input"',
    'Date': 'aria-label="Date input"',
    'Time': 'aria-label="Time input"',
    'URL': 'aria-label="URL input"',
    'Phone': 'aria-label="Phone number"',
    'Address': 'aria-label="Address input"',
    'City': 'aria-label="City input"',
    'State': 'aria-label="State input"',
    'Zip': 'aria-label="Zip code"',
    'Country': 'aria-label="Country input"'
  }
};

function fixAriaLabels(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Fix generic button aria-labels
  const buttonRegex = /aria-label="Button">([^<]*)</g;
  content = content.replace(buttonRegex, (match, buttonText) => {
    const trimmedText = buttonText.trim();
    const replacement = ariaLabelReplacements['aria-label="Button"'][trimmedText];
    if (replacement) {
      modified = true;
      return `${replacement}>${buttonText}<`;
    }
    // Default to using button text as label if not in map
    if (trimmedText) {
      modified = true;
      return `aria-label="${trimmedText.toLowerCase()}">${buttonText}<`;
    }
    return match;
  });
  
  // Fix onClick syntax errors with aria-label
  content = content.replace(/onClick=\{?\([^)]*\)\s*=\s*aria-label="[^"]*">/g, (match) => {
    modified = true;
    // Extract the onClick handler and aria-label separately
    const onClickMatch = match.match(/onClick=\{?\(([^)]*)\)[^}]*\}?/);
    const ariaMatch = match.match(/aria-label="([^"]*)"/);
    if (onClickMatch && ariaMatch) {
      return `onClick={(${onClickMatch[1]}) => {}} aria-label="${ariaMatch[1]}">`;
    }
    return match;
  });
  
  // Fix input field aria-labels
  const inputRegex = /aria-label="Input field"/g;
  content = content.replace(inputRegex, (match) => {
    modified = true;
    // Try to find placeholder or name attribute nearby
    const placeholderMatch = content.match(/placeholder="([^"]*)"/);
    if (placeholderMatch) {
      return `aria-label="${placeholderMatch[1].toLowerCase()} input"`;
    }
    return 'aria-label="Text input"';
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

// Find all TSX files in the components directory
const files = globSync('/home/weningerii/vtt/apps/client/src/components/**/*.tsx');

let fixedCount = 0;
files.forEach(file => {
  if (fixAriaLabels(file)) {
    console.log(`Fixed: ${file}`);
    fixedCount++;
  }
});

console.log(`\nFixed ARIA labels in ${fixedCount} files`);
