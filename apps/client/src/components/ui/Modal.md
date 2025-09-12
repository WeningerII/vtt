# Modal Component

## Overview

Accessible modal dialog component with dark theme styling, overlay management, and focus trapping. Designed for gaming environments with glass morphism and elevation effects.

## Usage

```tsx
import { Modal, ModalHeader, ModalBody, ModalFooter } from './Modal';

// Basic usage
<Modal isOpen={isOpen} onClose={handleClose} title="Character Details">
  <ModalBody>
    <p>Character information here...</p>
  </ModalBody>
</Modal>

// Full modal with header and footer
<Modal
  isOpen={showDialog}
  onClose={handleClose}
  variant="elevated"
  size="lg"
>
  <ModalHeader>
    <h2>Delete Character</h2>
    <p>This action cannot be undone</p>
  </ModalHeader>
  
  <ModalBody>
    <p>Are you sure you want to delete this character?</p>
  </ModalBody>
  
  <ModalFooter>
    <Button variant="ghost" onClick={handleClose}>Cancel</Button>
    <Button variant="danger" onClick={handleDelete}>Delete</Button>
  </ModalFooter>
</Modal>
```

## Props

### Modal Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | `boolean` | `false` | Controls modal visibility |
| `onClose` | `() => void` | - | Called when modal should close |
| `title` | `string` | - | Modal title (auto-generates header) |
| `variant` | `ModalVariant` | `'default'` | Visual style variant |
| `size` | `ModalSize` | `'md'` | Size preset |
| `closeOnOverlayClick` | `boolean` | `true` | Close when clicking overlay |
| `closeOnEscape` | `boolean` | `true` | Close on Escape key |
| `showCloseButton` | `boolean` | `true` | Show X button in header |

## Variants

### Visual Variants
- **`default`** - Standard modal with dark theme
- **`elevated`** - Enhanced shadow and border
- **`glass`** - Glass morphism with backdrop blur

### Size Variants
- **`sm`** - 400px max width
- **`md`** - 512px max width  
- **`lg`** - 768px max width
- **`xl`** - 1024px max width
- **`full`** - Full screen modal

## Design System Integration

### Dark Theme Colors
All styling uses design system tokens:

```css
/* Modal background */
background: var(--bg-secondary);
border: 1px solid var(--border-primary);

/* Overlay */
background: var(--bg-overlay);
backdrop-filter: blur(8px);

/* Text colors */
color: var(--text-primary);
```

### Glass Morphism Effect
```tsx
<Modal variant="glass" size="lg">
  {/* Backdrop blur with semi-transparent background */}
</Modal>
```

## Subcomponents

### ModalHeader
```tsx
<ModalHeader>
  <h2>Modal Title</h2>
  <p className="text-text-secondary">Optional description</p>
</ModalHeader>
```

### ModalBody
```tsx
<ModalBody className="space-y-4">
  <p>Modal content with proper spacing</p>
  <div>Additional content...</div>
</ModalBody>
```

### ModalFooter
```tsx
<ModalFooter>
  <Button variant="ghost">Secondary Action</Button>
  <Button variant="primary">Primary Action</Button>
</ModalFooter>
```

## Accessibility

### Focus Management
- Focus traps within modal when open
- Returns focus to trigger element on close
- Proper tab order through modal content
- Focus visible indicators

### ARIA Implementation
- `role="dialog"` on modal
- `aria-modal="true"` for screen readers
- `aria-labelledby` for title association
- `aria-describedby` for description

### Keyboard Support
- `Escape` key closes modal (configurable)
- `Tab` cycles through focusable elements
- Enter/Space activates buttons
- Focus management on open/close

## Examples

### Confirmation Dialog
```tsx
const [showConfirm, setShowConfirm] = useState(false);

<Modal
  isOpen={showConfirm}
  onClose={() => setShowConfirm(false)}
  title="Confirm Action"
  size="sm"
  variant="elevated"
>
  <ModalBody>
    <p>Are you sure you want to continue?</p>
  </ModalBody>
  
  <ModalFooter>
    <Button 
      variant="ghost" 
      onClick={() => setShowConfirm(false)}
    >
      Cancel
    </Button>
    <Button 
      variant="primary"
      onClick={handleConfirm}
    >
      Confirm
    </Button>
  </ModalFooter>
</Modal>
```

### Character Sheet Modal
```tsx
<Modal
  isOpen={showCharacter}
  onClose={closeCharacter}
  variant="glass"
  size="xl"
  title="Character Sheet"
>
  <ModalBody>
    <CharacterSheet characterId={selectedCharacter} />
  </ModalBody>
</Modal>
```

### Form Modal
```tsx
<Modal
  isOpen={showCreateForm}
  onClose={closeForm}
  size="lg"
  closeOnOverlayClick={false} // Prevent accidental closure
>
  <ModalHeader>
    <h2>Create New Character</h2>
    <p>Fill in the character details below</p>
  </ModalHeader>
  
  <ModalBody>
    <form onSubmit={handleSubmit}>
      <Input label="Name" value={name} onChange={setName} />
      <Input label="Class" value={characterClass} onChange={setClass} />
      {/* More form fields */}
    </form>
  </ModalBody>
  
  <ModalFooter>
    <Button variant="ghost" onClick={closeForm}>
      Cancel
    </Button>
    <Button 
      variant="primary" 
      onClick={handleSubmit}
      loading={isSubmitting}
    >
      Create Character
    </Button>
  </ModalFooter>
</Modal>
```

### Mobile-Optimized Modal
```tsx
<Modal
  isOpen={showMobileModal}
  onClose={closeMobileModal}
  size="full" // Full screen on mobile
  variant="default"
>
  <ModalHeader className="sticky top-0 bg-bg-secondary border-b border-border-primary">
    <h2>Mobile Interface</h2>
  </ModalHeader>
  
  <ModalBody className="overflow-y-auto">
    {/* Scrollable content */}
  </ModalBody>
  
  <ModalFooter className="sticky bottom-0 bg-bg-secondary border-t border-border-primary">
    <Button fullWidth size="lg" className="gaming-touch-target">
      Action Button
    </Button>
  </ModalFooter>
</Modal>
```

## Implementation Details

### CVA Variants
Type-safe styling with class-variance-authority:

```tsx
const modalVariants = cva([
  "relative bg-bg-secondary rounded-xl shadow-xl",
  "transform transition-all duration-200 ease-out",
  "max-h-[90vh] overflow-y-auto border border-border-primary"
], {
  variants: {
    variant: {
      default: "bg-bg-secondary border-border-primary",
      elevated: "bg-bg-secondary shadow-2xl border-border-primary", 
      glass: "bg-bg-secondary/80 backdrop-blur-lg border-border-secondary"
    },
    size: {
      sm: "max-w-md w-full mx-4",
      md: "max-w-lg w-full mx-4",
      lg: "max-w-2xl w-full mx-4", 
      xl: "max-w-4xl w-full mx-4",
      full: "max-w-full w-full h-full m-0 rounded-none"
    }
  }
});
```

### Focus Trapping
```tsx
useEffect(() => {
  if (isOpen) {
    const restoreFocus = FocusManager.saveFocus();
    FocusManager.trapFocus(modalRef.current);
    
    return () => {
      restoreFocus();
    };
  }
}, [isOpen]);
```

### Performance
- Portal rendering outside React tree
- Lazy loading of heavy modal content
- Optimized animations with CSS transforms
- Backdrop click detection optimization

### Testing
```tsx
// Modal.test.tsx
test('closes on escape key', () => {
  const handleClose = jest.fn();
  render(
    <Modal isOpen={true} onClose={handleClose}>
      <ModalBody>Test content</ModalBody>
    </Modal>
  );
  
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(handleClose).toHaveBeenCalled();
});

test('traps focus within modal', () => {
  render(
    <Modal isOpen={true} onClose={jest.fn()}>
      <ModalBody>
        <button>First button</button>
        <button>Second button</button>
      </ModalBody>
    </Modal>
  );
  
  const buttons = screen.getAllByRole('button');
  buttons[0].focus();
  
  fireEvent.keyDown(document, { key: 'Tab' });
  expect(buttons[1]).toHaveFocus();
});
```
