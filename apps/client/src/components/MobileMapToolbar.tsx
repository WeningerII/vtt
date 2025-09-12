/**
 * Mobile Map Toolbar Component
 * Collapsible, touch-friendly toolbar for map editing on mobile devices
 * Features: Gesture controls, haptic feedback, adaptive layout
 */

import React, { memo, useState, useCallback, useEffect } from 'react';
import { 
  MousePointer, 
  Paintbrush, 
  Eraser, 
  Users, 
  Grid3x3, 
  Palette,
  Settings,
  ChevronUp,
  ChevronDown,
  Minus,
  Plus,
  RotateCcw,
  Save,
  Layers,
  Zap
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';
import { Slider } from './ui/Slider';
import { Switch } from './ui/Switch';
import { Badge } from './ui/Badge';

interface MobileMapToolbarProps {
  activeTool: 'select' | 'brush' | 'eraser' | 'token';
  brushSize: number;
  showGrid: boolean;
  readOnly?: boolean;
  isGenerating?: boolean;
  onToolChange: (tool: 'select' | 'brush' | 'eraser' | 'token') => void;
  onBrushSizeChange?: (size: number) => void;
  onGridToggle?: (show: boolean) => void;
  onUndo?: (() => void) | undefined;
  onSave?: () => void;
  onGenerateAI?: () => void;
  className?: string;
}

export const MobileMapToolbar = memo<MobileMapToolbarProps>(function MobileMapToolbar({
  activeTool,
  brushSize,
  showGrid,
  readOnly = false,
  isGenerating = false,
  onToolChange,
  onBrushSizeChange,
  onGridToggle,
  onUndo,
  onSave,
  onGenerateAI,
  className
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activePanel, setActivePanel] = useState<'tools' | 'settings' | 'colors' | null>('tools');
  const [selectedColor, setSelectedColor] = useState('#000000');

  // Auto-collapse after inactivity
  useEffect(() => {
    if (!isExpanded) return;

    const timer = setTimeout(() => {
      setIsExpanded(false);
      setActivePanel(null);
    }, 10000); // Auto-collapse after 10 seconds

    return () => clearTimeout(timer);
  }, [isExpanded, activeTool, brushSize]);

  // Haptic feedback for tool changes
  const triggerHaptic = useCallback(() => {
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  }, []);

  const handleToolChange = useCallback((tool: typeof activeTool) => {
    onToolChange(tool);
    triggerHaptic();
    
    // Auto-expand when selecting a tool that needs settings
    if (tool === 'brush' && !isExpanded) {
      setIsExpanded(true);
      setActivePanel('settings');
    }
  }, [onToolChange, triggerHaptic, isExpanded]);

  const handleBrushSizeChange = useCallback((value: number[]) => {
    onBrushSizeChange?.(value[0]);
  }, [onBrushSizeChange]);

  const handleExpansionToggle = useCallback(() => {
    setIsExpanded(prev => {
      const newState = !prev;
      if (!newState) {
        setActivePanel(null);
      } else {
        setActivePanel('tools');
      }
      triggerHaptic();
      return newState;
    });
  }, [triggerHaptic]);

  const toolItems = [
    { id: 'select', icon: MousePointer, label: 'Select', color: 'text-blue-400' },
    { id: 'brush', icon: Paintbrush, label: 'Brush', color: 'text-green-400' },
    { id: 'eraser', icon: Eraser, label: 'Eraser', color: 'text-red-400' },
    { id: 'token', icon: Users, label: 'Token', color: 'text-purple-400' }
  ] as const;

  const quickColors = [
    '#000000', '#ffffff', '#ff0000', '#00ff00', 
    '#0000ff', '#ffff00', '#ff00ff', '#00ffff',
    '#8b4513', '#ffa500', '#800080', '#ffc0cb'
  ];

  return (
    <div className={cn(
      "mobile-map-toolbar",
      "fixed bottom-20 left-4 right-4 z-40",
      "bg-surface-elevated/95 backdrop-blur-md",
      "border border-border-subtle rounded-xl",
      "shadow-2xl transition-all duration-300",
      isExpanded ? "max-h-96" : "max-h-16",
      "overflow-hidden",
      className
    )}>
      {/* Header with main tools and expand toggle */}
      <div className="flex items-center justify-between p-3 border-b border-border-subtle">
        {/* Primary Tools */}
        <div className="flex items-center gap-2">
          {toolItems.map(({ id, icon: Icon, label, color }) => (
            <Button
              key={id}
              variant={activeTool === id ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => handleToolChange(id as 'select' | 'brush' | 'eraser' | 'token')}
              disabled={readOnly}
              className={cn(
                "h-10 w-10 p-0 rounded-lg touch-manipulation",
                activeTool === id && "ring-2 ring-primary-500 ring-offset-2 ring-offset-black",
                !readOnly && "hover:scale-105 active:scale-95"
              )}
              aria-label={`${label} tool`}
              aria-pressed={activeTool === id}
            >
              <Icon className={cn("h-5 w-5", activeTool === id ? "text-white" : color)} />
            </Button>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          {/* Grid Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onGridToggle?.(!showGrid)}
            className={cn(
              "h-10 w-10 p-0 rounded-lg",
              showGrid && "bg-surface-accent text-color-accent-primary"
            )}
            aria-label={showGrid ? "Hide grid" : "Show grid"}
            aria-pressed={showGrid}
          >
            <Grid3x3 className="h-4 w-4" />
          </Button>

          {/* Expand/Collapse */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExpansionToggle}
            className="h-10 w-10 p-0 rounded-lg"
            aria-label={isExpanded ? "Collapse toolbar" : "Expand toolbar"}
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-3 space-y-4">
          {/* Panel Navigation */}
          <div className="flex items-center gap-1 bg-surface-subtle rounded-lg p-1">
            {[
              { id: 'tools', label: 'Tools', icon: Settings },
              { id: 'settings', label: 'Settings', icon: Palette },
              { id: 'colors', label: 'Colors', icon: Palette }
            ].map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                variant={activePanel === id ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setActivePanel(id as typeof activePanel)}
                className="flex-1 h-8 text-xs"
              >
                <Icon className="h-3 w-3 mr-1" />
                {label}
              </Button>
            ))}
          </div>

          {/* Tools Panel */}
          {activePanel === 'tools' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">Quick Actions</span>
                <Badge variant="secondary" className="text-xs">
                  {activeTool}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {onUndo && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onUndo}
                    disabled={readOnly}
                    className="h-12 flex-col gap-1"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span className="text-xs">Undo</span>
                  </Button>
                )}

                {onSave && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onSave}
                    disabled={readOnly}
                    className="h-12 flex-col gap-1"
                  >
                    <Save className="h-4 w-4" />
                    <span className="text-xs">Save</span>
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="h-12 flex-col gap-1"
                  disabled
                >
                  <Layers className="h-4 w-4" />
                  <span className="text-xs">Layers</span>
                </Button>

                {onGenerateAI && (
                  <Button
                    variant={isGenerating ? "outline" : "secondary"}
                    size="sm"
                    onClick={onGenerateAI}
                    disabled={readOnly || isGenerating}
                    className="h-12 flex-col gap-1"
                  >
                    <Zap className={cn("h-4 w-4", isGenerating && "animate-pulse")} />
                    <span className="text-xs">
                      {isGenerating ? "..." : "AI Gen"}
                    </span>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Settings Panel */}
          {activePanel === 'settings' && (
            <div className="space-y-4">
              {/* Brush Size */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-text-primary">
                    Brush Size
                  </label>
                  <Badge variant="outline" className="text-xs">
                    {brushSize}px
                  </Badge>
                </div>
                <Slider
                  value={[brushSize]}
                  onValueChange={handleBrushSizeChange}
                  min={1}
                  max={50}
                  step={1}
                  className="w-full"
                  disabled={readOnly}
                />
                <div className="flex justify-between text-xs text-text-secondary">
                  <span>1px</span>
                  <span>50px</span>
                </div>
              </div>

              {/* Grid Settings */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-text-primary">Show Grid</div>
                  <div className="text-xs text-text-secondary">
                    Display alignment grid
                  </div>
                </div>
                <Switch
                  checked={showGrid}
                  onCheckedChange={onGridToggle}
                  size="md"
                />
              </div>

              {/* Opacity Control (Future Enhancement) */}
              <div className="space-y-2 opacity-50">
                <label className="text-sm font-medium text-text-primary">
                  Opacity (Coming Soon)
                </label>
                <Slider
                  value={[100]}
                  min={10}
                  max={100}
                  disabled
                  className="w-full"
                />
              </div>
            </div>
          )}

          {/* Colors Panel */}
          {activePanel === 'colors' && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-text-primary">
                Quick Colors
              </div>
              
              <div className="grid grid-cols-6 gap-2">
                {quickColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={cn(
                      "w-8 h-8 rounded-lg border-2 transition-all",
                      "hover:scale-110 active:scale-95",
                      selectedColor === color 
                        ? "border-primary-500 ring-2 ring-primary-500 ring-offset-2 ring-offset-black" 
                        : "border-border-subtle hover:border-border-primary"
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                    disabled={readOnly}
                  />
                ))}
              </div>

              {/* Current Color */}
              <div className="flex items-center gap-3 p-3 bg-surface-subtle rounded-lg">
                <div 
                  className="w-8 h-8 rounded-lg border border-border-subtle"
                  style={{ backgroundColor: selectedColor }}
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">Selected Color</div>
                  <div className="text-xs text-text-secondary font-mono">
                    {selectedColor.toUpperCase()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Collapse Hint */}
      {!isExpanded && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-1 bg-surface-overlay text-text-secondary text-xs rounded opacity-60">
          Tap to expand tools
        </div>
      )}
    </div>
  );
});

export default MobileMapToolbar;
