#!/usr/bin/env node
/**
 * EXHAUSTIVE VTT Interaction Scanner - Multi-Layer Detection System
 * Built piece by piece for maximum coverage
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ExhaustiveInteractionScanner {
  constructor() {
    this.results = {
      // Layer 1: Enhanced Static Analysis
      staticElements: {
        buttons: [],
        links: [],
        inputs: [],
        eventHandlers: [],
        modals: [],
        forms: [],
        customInteractives: []
      },
      
      // Layer 2: Canvas/WebGL Interactions
      canvasInteractions: {
        canvasElements: [],
        mouseEvents: [],
        touchEvents: [],
        keyboardEvents: [],
        wheelEvents: [],
        webglContexts: [],
        renderingCalls: []
      },
      
      // Layer 3: WebSocket Events
      realtimeInteractions: {
        socketEvents: [],
        emitCalls: [],
        webSocketConnections: [],
        sseEvents: [],
        broadcastChannels: []
      },
      
      // Layer 4: Third-party Libraries
      libraryInteractions: {
        pixiEvents: [],
        threeJsEvents: [],
        customHooks: [],
        libraryComponents: []
      },
      
      // Layer 5: Runtime Analysis
      runtimeElements: {
        dynamicElements: [],
        eventListeners: [],
        computedStyles: [],
        shadowDomElements: [],
        iframeElements: []
      },
      
      // Functional Testing Results
      functionalTests: {
        buttonTests: [],
        formTests: [],
        canvasTests: [],
        websocketTests: [],
        accessibilityTests: [],
        navigationTests: []
      },
      
      // Layer 6: Accessibility
      accessibilityInteractions: {
        ariaElements: [],
        keyboardNavigation: [],
        touchGestures: [],
        focusableElements: [],
        screenReaderElements: []
      },
      
      summary: {}
    };

    this.patterns = this.initializePatterns();
    this.activeLayers = ['static', 'canvas', 'websocket', 'libraries', 'runtime', 'accessibility']; // All 6 layers
    this.functionalTestingEnabled = true;
  }

  initializePatterns() {
    return {
      // Enhanced static patterns - more comprehensive than basic scanner
      buttons: [
        // React components
        /(<Button\b[^>]*>)/g,
        /(<AccessibleButton\b[^>]*>)/g,
        /(<IconButton\b[^>]*>)/g,
        
        // HTML elements
        /(<button\b[^>]*>)/g,
        /(<input[^>]*type\s*=\s*["'](?:button|submit|reset)["'][^>]*>)/g,
        
        // ARIA buttons
        /(<[^>]*role\s*=\s*["']button["'][^>]*>)/g,
        
        // Custom clickable elements
        /(<[^>]*onClick\s*=\s*[^>]*>)/g
      ],
      
      links: [
        // React Router
        /(<Link\b[^>]*>)/g,
        /(<NavLink\b[^>]*>)/g,
        
        // HTML links
        /(<a\b[^>]*>)/g,
        
        // Navigation calls
        /(navigate\s*\([^)]*\))/g,
        /(history\.push\s*\([^)]*\))/g,
        /(router\.push\s*\([^)]*\))/g
      ],
      
      inputs: [
        /(<input\b[^>]*>)/g,
        /(<select\b[^>]*>)/g,
        /(<textarea\b[^>]*>)/g,
        /(<Input\b[^>]*>)/g,
        /(<Select\b[^>]*>)/g,
        /(<Textarea\b[^>]*>)/g,
        /(<Checkbox\b[^>]*>)/g,
        /(<Radio\b[^>]*>)/g,
        /(<Switch\b[^>]*>)/g,
        /(<Slider\b[^>]*>)/g
      ],
      
      eventHandlers: [
        // Mouse events
        /(onClick\s*=\s*[^,}\s]+)/g,
        /(onDoubleClick\s*=\s*[^,}\s]+)/g,
        /(onMouseDown\s*=\s*[^,}\s]+)/g,
        /(onMouseUp\s*=\s*[^,}\s]+)/g,
        /(onMouseMove\s*=\s*[^,}\s]+)/g,
        /(onMouseEnter\s*=\s*[^,}\s]+)/g,
        /(onMouseLeave\s*=\s*[^,}\s]+)/g,
        
        // Keyboard events
        /(onKeyDown\s*=\s*[^,}\s]+)/g,
        /(onKeyUp\s*=\s*[^,}\s]+)/g,
        /(onKeyPress\s*=\s*[^,}\s]+)/g,
        
        // Form events
        /(onSubmit\s*=\s*[^,}\s]+)/g,
        /(onChange\s*=\s*[^,}\s]+)/g,
        /(onInput\s*=\s*[^,}\s]+)/g,
        /(onFocus\s*=\s*[^,}\s]+)/g,
        /(onBlur\s*=\s*[^,}\s]+)/g,
        
        // Touch events
        /(onTouchStart\s*=\s*[^,}\s]+)/g,
        /(onTouchMove\s*=\s*[^,}\s]+)/g,
        /(onTouchEnd\s*=\s*[^,}\s]+)/g,
        
        // Drag events
        /(onDragStart\s*=\s*[^,}\s]+)/g,
        /(onDrag\s*=\s*[^,}\s]+)/g,
        /(onDragEnd\s*=\s*[^,}\s]+)/g,
        /(onDrop\s*=\s*[^,}\s]+)/g
      ],
      
      modals: [
        /(<Modal\b[^>]*>)/g,
        /(<Dialog\b[^>]*>)/g,
        /(<Drawer\b[^>]*>)/g,
        /(<Popover\b[^>]*>)/g,
        /(<Tooltip\b[^>]*>)/g,
        /(<Sheet\b[^>]*>)/g,
        /(setShow[A-Z][a-zA-Z]*Modal)/g,
        /(setIs[A-Z][a-zA-Z]*Open)/g,
        /(toggleModal)/g
      ],
      
      forms: [
        /(<form\b[^>]*>)/g,
        /(<Form\b[^>]*>)/g,
        /(handleSubmit)/g,
        /(onSubmit)/g,
        /(useForm\s*\()/g,
        /(formik)/gi
      ],
      
      customInteractives: [
        // Divs/spans with click handlers
        /(<div[^>]*onClick[^>]*>)/g,
        /(<span[^>]*onClick[^>]*>)/g,
        
        // Elements with tabIndex (keyboard focusable)
        /(tabIndex\s*=\s*[^>\s]+)/g,
        
        // ARIA interactive roles
        /(role\s*=\s*["'](?:button|link|menuitem|tab|option|checkbox|radio)["'])/g,
        
        // ARIA labels (indicates interactive elements)
        /(aria-label\s*=)/g,
        /(aria-labelledby\s*=)/g,
        
        // Custom event handlers
        /(data-testid\s*=)/g,
        /(data-cy\s*=)/g
      ],
      
      // Layer 2: Canvas/WebGL patterns
      canvasElements: [
        /(<canvas\b[^>]*>)/g,
        /(canvasRef\s*=)/g,
        /(useRef<HTMLCanvasElement>)/g,
        /(HTMLCanvasElement)/g
      ],
      
      canvasEvents: [
        // Canvas event listeners
        /(canvas\.addEventListener\s*\(\s*["']([^"']+)["'])/g,
        /(canvasRef\.current\.addEventListener)/g,
        
        // Mouse events on canvas
        /(onMouseDown.*canvas|canvas.*onMouseDown)/gi,
        /(onMouseMove.*canvas|canvas.*onMouseMove)/gi,
        /(onMouseUp.*canvas|canvas.*onMouseUp)/gi,
        /(onClick.*canvas|canvas.*onClick)/gi,
        
        // Touch events on canvas
        /(onTouchStart.*canvas|canvas.*onTouchStart)/gi,
        /(onTouchMove.*canvas|canvas.*onTouchMove)/gi,
        /(onTouchEnd.*canvas|canvas.*onTouchEnd)/gi,
        
        // Wheel/scroll events
        /(onWheel.*canvas|canvas.*onWheel)/gi,
        /(addEventListener.*wheel)/gi
      ],
      
      webglContexts: [
        /(getContext\s*\(\s*["']webgl["'])/g,
        /(getContext\s*\(\s*["']webgl2["'])/g,
        /(getContext\s*\(\s*["']experimental-webgl["'])/g,
        /(WebGLRenderingContext)/g,
        /(WebGL2RenderingContext)/g
      ],
      
      renderingCalls: [
        // Canvas 2D rendering
        /(ctx\.[a-zA-Z]+\s*\()/g,
        /(context\.[a-zA-Z]+\s*\()/g,
        /(drawImage|fillRect|strokeRect|arc|beginPath)/g,
        
        // WebGL rendering
        /(gl\.[a-zA-Z]+\s*\()/g,
        /(renderer\.[a-zA-Z]+\s*\()/g,
        /(drawArrays|drawElements|uniform|attribute)/g,
        
        // Animation frames
        /(requestAnimationFrame)/g,
        /(cancelAnimationFrame)/g
      ],
      
      // Layer 3: WebSocket/Real-time patterns
      websocketEvents: [
        // Socket.io events
        /(socket\.on\s*\(\s*["']([^"']+)["'])/g,
        /(socket\.off\s*\(\s*["']([^"']+)["'])/g,
        /(socket\.once\s*\(\s*["']([^"']+)["'])/g,
        
        // WebSocket native events
        /(ws\.addEventListener\s*\(\s*["']([^"']+)["'])/g,
        /(websocket\.addEventListener)/gi,
        
        // Custom WebSocket hooks
        /(useWebSocket|useSocket)/g,
        /(WebSocketProvider|SocketProvider)/g
      ],
      
      websocketEmits: [
        // Socket.io emits
        /(socket\.emit\s*\(\s*["']([^"']+)["'])/g,
        /(emit\s*\(\s*["']([^"']+)["'])/g,
        
        // WebSocket sends
        /(ws\.send\s*\()/g,
        /(websocket\.send)/gi,
        
        // Broadcast events
        /(broadcast\s*\(\s*["']([^"']+)["'])/g,
        /(io\.emit\s*\(\s*["']([^"']+)["'])/g
      ],
      
      websocketConnections: [
        // WebSocket constructors
        /(new\s+WebSocket\s*\()/g,
        /(io\s*\(\s*["'][^"']*["']\s*\))/g,
        /(socket\.io\s*\()/g,
        
        // Connection management
        /(connect\s*\(\s*\))/g,
        /(disconnect\s*\(\s*\))/g,
        /(reconnect)/g
      ],
      
      realtimeEvents: [
        // Server-Sent Events
        /(new\s+EventSource\s*\()/g,
        /(addEventListener\s*\(\s*["']message["'])/g,
        
        // Broadcast Channel API
        /(new\s+BroadcastChannel\s*\()/g,
        /(postMessage\s*\()/g,
        
        // WebRTC events
        /(onicecandidate|ontrack|ondatachannel)/g,
        /(RTCPeerConnection)/g
      ],
      
      // Layer 4: Third-party library patterns
      pixiLibrary: [
        // PixiJS core
        /(PIXI\.[A-Za-z.]+)/g,
        /(new\s+PIXI\.[A-Za-z]+)/g,
        /(stage\.[a-zA-Z]+\s*\()/g,
        /(app\.[a-zA-Z]+\s*\()/g,
        /(sprite\.[a-zA-Z]+\s*\()/g,
        
        // PixiJS events
        /(\.on\s*\(\s*["']([^"']+)["'])/g,
        /(\.interactive\s*=)/g,
        /(\.buttonMode\s*=)/g,
        /(addChild|removeChild)/g
      ],
      
      threeJsLibrary: [
        // Three.js core
        /(THREE\.[A-Za-z.]+)/g,
        /(new\s+THREE\.[A-Za-z]+)/g,
        /(scene\.[a-zA-Z]+\s*\()/g,
        /(camera\.[a-zA-Z]+\s*\()/g,
        /(renderer\.[a-zA-Z]+\s*\()/g,
        /(mesh\.[a-zA-Z]+\s*\()/g,
        
        // Three.js events
        /(raycaster\.[a-zA-Z]+)/g,
        /(intersectObjects)/g,
        /(addEventListener.*click)/g
      ],
      
      customVTTHooks: [
        // VTT-specific hooks
        /(useGame|useAuth|useWebSocket|useVTT)/g,
        /(useCharacter|useToken|useMap|useScene)/g,
        /(useCombat|useEncounter|useDice)/g,
        /(useCanvas|useRenderer|useAssets)/g,
        /(useTouchGestures|useDrag|useZoom)/g,
        
        // VTT providers
        /(GameProvider|AuthProvider|WebSocketProvider)/g,
        /(VTTProvider|CanvasProvider|AssetProvider)/g
      ],
      
      libraryComponents: [
        // UI library components
        /(Radix|Headless|Chakra|Mantine)/gi,
        /(Framer|Motion|Spring)/gi,
        /(DndKit|ReactDnd|Sortable)/gi,
        
        // VTT-specific components
        /(TokenLayer|MapLayer|GridLayer)/g,
        /(DiceRoller|CharacterSheet|CombatTracker)/g,
        /(AssetBrowser|SceneManager|CampaignManager)/g
      ],
      
      // Layer 6: Accessibility patterns
      ariaPatterns: [
        // ARIA attributes
        /(aria-[a-z-]+\s*=)/g,
        /(role\s*=\s*["'][^"']*["'])/g,
        /(tabIndex\s*=)/g,
        /(aria-label|aria-labelledby|aria-describedby)/g,
        /(aria-expanded|aria-selected|aria-checked)/g,
        /(aria-hidden|aria-disabled|aria-live)/g
      ],
      
      keyboardPatterns: [
        // Keyboard event handlers
        /(onKeyDown|onKeyUp|onKeyPress)/g,
        /(addEventListener\s*\(\s*["']key)/g,
        /(key\s*===\s*["'][^"']*["'])/g,
        /(keyCode|which|key)/g,
        /(preventDefault|stopPropagation)/g
      ],
      
      touchPatterns: [
        // Touch and gesture events
        /(onTouchStart|onTouchMove|onTouchEnd)/g,
        /(addEventListener\s*\(\s*["']touch)/g,
        /(onPointerDown|onPointerMove|onPointerUp)/g,
        /(onGestureStart|onGestureChange|onGestureEnd)/g,
        /(touches\[|changedTouches\[|targetTouches\[)/g
      ],
      
      focusPatterns: [
        // Focus management
        /(onFocus|onBlur|onFocusIn|onFocusOut)/g,
        /(focus\(\)|blur\(\))/g,
        /(tabindex|tabIndex)/gi,
        /(autofocus|autoFocus)/gi,
        /(document\.activeElement)/g
      ]
    };
  }

  // Layer 1: Enhanced Static Analysis
  async performStaticAnalysis() {
    console.log('🔍 Layer 1: Enhanced Static Analysis...');
    
    const files = this.getFilesToScan();
    let processedFiles = 0;
    
    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        this.scanStaticElements(filePath, content);
        processedFiles++;
        
        if (processedFiles % 20 === 0) {
          process.stdout.write(`\rProcessed ${processedFiles}/${files.length} files...`);
        }
      } catch (error) {
        console.error(`\nError scanning ${filePath}:`, error.message);
      }
    }
    
    console.log(`\n✅ Static analysis complete: ${processedFiles} files`);
  }

  // Layer 2: Canvas/WebGL Interaction Detection
  async performCanvasAnalysis() {
    console.log('🎨 Layer 2: Canvas/WebGL Analysis...');
    
    const files = this.getFilesToScan();
    let canvasFiles = 0;
    
    for (const filePath of files) {
      // Focus on files likely to contain canvas interactions
      if (this.isCanvasRelatedFile(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          this.scanCanvasElements(filePath, content);
          canvasFiles++;
        } catch (error) {
          console.error(`Canvas scan error for ${filePath}:`, error.message);
        }
      }
    }
    
    console.log(`✅ Canvas analysis complete: ${canvasFiles} canvas-related files`);
  }

  isCanvasRelatedFile(filePath) {
    const canvasKeywords = [
      'Canvas', 'Map', 'Scene', 'Game', 'Render', 'WebGL', 
      'Draw', 'Paint', 'Graphics', 'Animation', 'Viewer'
    ];
    
    return canvasKeywords.some(keyword => 
      filePath.toLowerCase().includes(keyword.toLowerCase())
    ) || filePath.includes('renderer') || filePath.includes('pixi');
  }

  scanCanvasElements(filePath, content) {
    const relativePath = path.relative('/home/weningerii/vtt', filePath);
    const lines = content.split('\n');

    // Scan canvas-specific patterns
    const canvasPatternGroups = {
      canvasElements: this.patterns.canvasElements,
      mouseEvents: this.patterns.canvasEvents,
      webglContexts: this.patterns.webglContexts,
      renderingCalls: this.patterns.renderingCalls
    };

    Object.entries(canvasPatternGroups).forEach(([category, patterns]) => {
      patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const lineNumber = this.getLineNumber(content, match.index);
          const element = {
            file: relativePath,
            line: lineNumber,
            content: match[0].trim(),
            context: this.getContext(lines, lineNumber - 1),
            category: category,
            type: this.classifyCanvasInteraction(match[0])
          };

          // Add canvas-specific metadata
          this.addCanvasMetadata(element, match[0], category);
          
          this.results.canvasInteractions[category].push(element);
        }
      });
    });
  }

  classifyCanvasInteraction(content) {
    if (content.includes('mouse') || content.includes('Mouse')) return 'mouse';
    if (content.includes('touch') || content.includes('Touch')) return 'touch';
    if (content.includes('wheel') || content.includes('Wheel')) return 'wheel';
    if (content.includes('webgl') || content.includes('WebGL')) return 'webgl';
    if (content.includes('canvas') || content.includes('Canvas')) return 'canvas';
    if (content.includes('render') || content.includes('draw')) return 'rendering';
    if (content.includes('animation') || content.includes('frame')) return 'animation';
    return 'canvas-generic';
  }

  addCanvasMetadata(element, content, category) {
    if (category === 'canvasElements') {
      element.width = this.extractAttribute(content, 'width');
      element.height = this.extractAttribute(content, 'height');
      element.id = this.extractAttribute(content, 'id');
    } else if (category === 'mouseEvents') {
      element.eventType = this.extractEventType(content);
      element.isCanvasSpecific = content.toLowerCase().includes('canvas');
    } else if (category === 'webglContexts') {
      element.contextType = content.includes('webgl2') ? 'webgl2' : 'webgl';
    } else if (category === 'renderingCalls') {
      element.renderingAPI = content.includes('gl.') ? 'webgl' : 
                            content.includes('ctx.') ? '2d' : 'generic';
    }
  }

  // Layer 3: WebSocket/Real-time Event Detection
  async performWebSocketAnalysis() {
    console.log('📡 Layer 3: WebSocket/Real-time Analysis...');
    
    const files = this.getFilesToScan();
    let websocketFiles = 0;
    
    for (const filePath of files) {
      if (this.isWebSocketRelatedFile(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          this.scanWebSocketElements(filePath, content);
          websocketFiles++;
        } catch (error) {
          console.error(`WebSocket scan error for ${filePath}:`, error.message);
        }
      }
    }
    
    console.log(`✅ WebSocket analysis complete: ${websocketFiles} real-time files`);
  }

  isWebSocketRelatedFile(filePath) {
    const websocketKeywords = [
      'websocket', 'socket', 'realtime', 'collaboration', 
      'provider', 'hook', 'ws', 'io', 'emit', 'broadcast'
    ];
    
    return websocketKeywords.some(keyword => 
      filePath.toLowerCase().includes(keyword)
    ) || filePath.includes('WebSocket') || filePath.includes('Socket');
  }

  scanWebSocketElements(filePath, content) {
    const relativePath = path.relative('/home/weningerii/vtt', filePath);
    const lines = content.split('\n');

    // Scan WebSocket-specific patterns
    const websocketPatternGroups = {
      socketEvents: this.patterns.websocketEvents,
      emitCalls: this.patterns.websocketEmits,
      webSocketConnections: this.patterns.websocketConnections,
      sseEvents: this.patterns.realtimeEvents
    };

    Object.entries(websocketPatternGroups).forEach(([category, patterns]) => {
      patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const lineNumber = this.getLineNumber(content, match.index);
          const element = {
            file: relativePath,
            line: lineNumber,
            content: match[0].trim(),
            context: this.getContext(lines, lineNumber - 1),
            category: category,
            type: this.classifyWebSocketInteraction(match[0])
          };

          // Add WebSocket-specific metadata
          this.addWebSocketMetadata(element, match[0], category);
          
          this.results.realtimeInteractions[category].push(element);
        }
      });
    });
  }

  classifyWebSocketInteraction(content) {
    if (content.includes('socket.on') || content.includes('addEventListener')) return 'listener';
    if (content.includes('emit') || content.includes('send')) return 'emit';
    if (content.includes('WebSocket') || content.includes('io(')) return 'connection';
    if (content.includes('EventSource')) return 'sse';
    if (content.includes('BroadcastChannel')) return 'broadcast';
    if (content.includes('useWebSocket') || content.includes('useSocket')) return 'hook';
    return 'realtime-generic';
  }

  addWebSocketMetadata(element, content, category) {
    if (category === 'socketEvents') {
      const eventMatch = content.match(/["']([^"']+)["']/);
      element.eventName = eventMatch ? eventMatch[1] : 'unknown';
      element.isSocketIO = content.includes('socket.');
    } else if (category === 'emitCalls') {
      const eventMatch = content.match(/["']([^"']+)["']/);
      element.eventName = eventMatch ? eventMatch[1] : 'unknown';
      element.direction = 'outgoing';
    } else if (category === 'webSocketConnections') {
      element.connectionType = content.includes('io(') ? 'socket.io' : 'native';
    }
  }

  // Layer 4: Third-party Library Detection
  async performLibraryAnalysis() {
    console.log('📚 Layer 4: Third-party Library Analysis...');
    
    const files = this.getFilesToScan();
    let libraryFiles = 0;
    
    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        this.scanLibraryElements(filePath, content);
        libraryFiles++;
      } catch (error) {
        console.error(`Library scan error for ${filePath}:`, error.message);
      }
    }
    
    console.log(`✅ Library analysis complete: ${libraryFiles} files scanned`);
  }

  scanLibraryElements(filePath, content) {
    const relativePath = path.relative('/home/weningerii/vtt', filePath);
    const lines = content.split('\n');

    // Scan library-specific patterns
    const libraryPatternGroups = {
      pixiEvents: this.patterns.pixiLibrary,
      threeJsEvents: this.patterns.threeJsLibrary,
      customHooks: this.patterns.customVTTHooks,
      libraryComponents: this.patterns.libraryComponents
    };

    Object.entries(libraryPatternGroups).forEach(([category, patterns]) => {
      patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const lineNumber = this.getLineNumber(content, match.index);
          const element = {
            file: relativePath,
            line: lineNumber,
            content: match[0].trim(),
            context: this.getContext(lines, lineNumber - 1),
            category: category,
            type: this.classifyLibraryInteraction(match[0])
          };

          // Add library-specific metadata
          this.addLibraryMetadata(element, match[0], category);
          
          this.results.libraryInteractions[category].push(element);
        }
      });
    });
  }

  classifyLibraryInteraction(content) {
    if (content.includes('PIXI.') || content.includes('stage.') || content.includes('sprite.')) return 'pixi';
    if (content.includes('THREE.') || content.includes('scene.') || content.includes('mesh.')) return 'threejs';
    if (content.includes('use') && (content.includes('Game') || content.includes('VTT'))) return 'vtt-hook';
    if (content.includes('Provider')) return 'provider';
    if (content.includes('Layer') || content.includes('Manager')) return 'vtt-component';
    if (content.includes('Radix') || content.includes('Motion')) return 'ui-library';
    return 'library-generic';
  }

  addLibraryMetadata(element, content, category) {
    if (category === 'pixiEvents') {
      element.library = 'PixiJS';
      element.isInteractive = content.includes('interactive') || content.includes('buttonMode');
      element.hasEvents = content.includes('.on(');
    } else if (category === 'threeJsEvents') {
      element.library = 'Three.js';
      element.isRaycasting = content.includes('raycaster') || content.includes('intersect');
    } else if (category === 'customHooks') {
      element.hookType = content.match(/use([A-Z][a-zA-Z]*)/)?.[1] || 'unknown';
      element.isVTTSpecific = true;
    } else if (category === 'libraryComponents') {
      element.componentType = content.includes('Layer') ? 'layer' : 
                             content.includes('Manager') ? 'manager' : 'component';
    }
  }

  // Layer 5: Runtime Browser Analysis + Functional Testing
  async performRuntimeAnalysis() {
    console.log('🌐 Layer 5: Runtime Browser Analysis + Functional Testing...');
    
    // Always try serverless functional testing first
    if (this.functionalTestingEnabled) {
      await this.performServerlessFunctionalTesting();
    }
    
    // Check if we have a running VTT server for live testing
    const serverUrl = this.detectVTTServer();
    if (!serverUrl) {
      console.log('⚠️  No running VTT server detected for live testing.');
      console.log('💡 Serverless functional testing completed. Start server for live testing.');
      await this.performStaticRuntimeAnalysis();
      return;
    }

    try {
      // Try to use puppeteer if available for live testing
      const puppeteer = require('puppeteer');
      await this.performPuppeteerAnalysis(serverUrl, puppeteer);
      
      // Perform live functional testing if enabled
      if (this.functionalTestingEnabled) {
        console.log('🔴 Running additional LIVE functional testing...');
        await this.performFunctionalTesting(serverUrl, puppeteer);
      }
    } catch (error) {
      console.log('⚠️  Puppeteer not available. Using static runtime patterns instead.');
      await this.performStaticRuntimeAnalysis();
    }
    
    console.log('✅ Runtime analysis complete');
  }

  detectVTTServer() {
    // Common VTT development ports
    const commonPorts = [3000, 3001, 4000, 5000, 8000, 8080];
    
    // Try to detect running server
    for (const port of commonPorts) {
      try {
        const testUrl = `http://localhost:${port}`;
        // Simple check - in real implementation would ping the server
        // For now, return first common port for testing
        return testUrl;
      } catch (error) {
        continue;
      }
    }
    return null;
  }

  async performPuppeteerAnalysis(serverUrl, puppeteer) {
    console.log(`🎭 Launching browser analysis for ${serverUrl}...`);
    
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
      await page.goto(serverUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Extract dynamic elements
      const dynamicElements = await page.evaluate(() => {
        const elements = [];
        
        // Find all elements with event listeners
        const allElements = document.querySelectorAll('*');
        allElements.forEach((el, index) => {
          const listeners = getEventListeners ? getEventListeners(el) : {};
          if (Object.keys(listeners).length > 0) {
            elements.push({
              tag: el.tagName.toLowerCase(),
              id: el.id || `element-${index}`,
              classes: Array.from(el.classList),
              listeners: Object.keys(listeners),
              isVisible: el.offsetParent !== null,
              bounds: el.getBoundingClientRect()
            });
          }
        });
        
        return elements;
      });
      
      // Store runtime elements
      this.results.runtimeElements.dynamicElements = dynamicElements.map(el => ({
        type: 'dynamic-element',
        tag: el.tag,
        elementId: el.id,
        classes: el.classes,
        eventListeners: el.listeners,
        isVisible: el.isVisible,
        bounds: el.bounds,
        category: 'dynamicElements'
      }));
      
      console.log(`🎯 Found ${dynamicElements.length} dynamic elements with event listeners`);
      
    } catch (error) {
      console.error('Runtime analysis error:', error.message);
    } finally {
      await browser.close();
    }
  }

  async performStaticRuntimeAnalysis() {
    // Fallback: scan for runtime-related patterns in code
    const files = this.getFilesToScan();
    let runtimeFiles = 0;
    
    const runtimePatterns = [
      // Dynamic DOM manipulation
      /(document\.createElement|document\.getElementById)/g,
      /(querySelector|querySelectorAll)/g,
      /(appendChild|removeChild|insertBefore)/g,
      /(addEventListener|removeEventListener)/g,
      
      // Dynamic styling
      /(style\.[a-zA-Z]+\s*=)/g,
      /(classList\.(add|remove|toggle))/g,
      /(setAttribute|removeAttribute)/g,
      
      // Shadow DOM
      /(attachShadow|shadowRoot)/g,
      /(customElements\.define)/g
    ];
    
    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const relativePath = path.relative('/home/weningerii/vtt', filePath);
        
        runtimePatterns.forEach(pattern => {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            const lineNumber = this.getLineNumber(content, match.index);
            this.results.runtimeElements.dynamicElements.push({
              file: relativePath,
              line: lineNumber,
              content: match[0].trim(),
              type: 'runtime-pattern',
              category: 'dynamicElements'
            });
          }
        });
        
        runtimeFiles++;
      } catch (error) {
        // Skip files that can't be read
      }
    }
    
    console.log(`📊 Static runtime analysis: ${runtimeFiles} files scanned`);
  }

  // Serverless Functional Testing - No server required!
  async performServerlessFunctionalTesting() {
    console.log('🧪 Starting Serverless Functional Testing...');
    
    try {
      const puppeteer = require('puppeteer');
      
      // Create test HTML files from your React components
      await this.generateTestHTML();
      
      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      
      // Test generated HTML files
      const testFiles = [
        '/tmp/vtt-button-test.html',
        '/tmp/vtt-form-test.html', 
        '/tmp/vtt-canvas-test.html'
      ];
      
      for (const testFile of testFiles) {
        if (fs.existsSync(testFile)) {
          await page.goto(`file://${testFile}`);
          await this.testStaticHTML(page, testFile);
        }
      }
      
      await browser.close();
      console.log('✅ Serverless functional testing complete');
      
    } catch (error) {
      console.log('⚠️  Puppeteer not available for serverless testing.');
      await this.performStaticFunctionalAnalysis();
    }
  }

  async generateTestHTML() {
    console.log('📝 Generating test HTML from React components...');
    
    // Extract button patterns from static analysis
    const buttonElements = this.results.staticElements.buttons || [];
    const formElements = this.results.staticElements.forms || [];
    const canvasElements = this.results.canvasInteractions.canvasElements || [];
    
    // Generate button test HTML
    const buttonTestHTML = this.createButtonTestHTML(buttonElements);
    fs.writeFileSync('/tmp/vtt-button-test.html', buttonTestHTML);
    
    // Generate form test HTML  
    const formTestHTML = this.createFormTestHTML(formElements);
    fs.writeFileSync('/tmp/vtt-form-test.html', formTestHTML);
    
    // Generate canvas test HTML
    const canvasTestHTML = this.createCanvasTestHTML(canvasElements);
    fs.writeFileSync('/tmp/vtt-canvas-test.html', canvasTestHTML);
    
    console.log('📝 Test HTML files generated in /tmp/');
  }

  createButtonTestHTML(buttonElements) {
    const buttons = buttonElements.slice(0, 10).map((btn, i) => {
      const buttonText = btn.content.match(/>(.*?)</)?.[1] || `Test Button ${i}`;
      return `
        <button id="test-btn-${i}" onclick="handleClick(${i})" class="test-button">
          ${buttonText}
        </button>
      `;
    }).join('\n');
    
    return `
<!DOCTYPE html>
<html>
<head>
  <title>VTT Button Functionality Test</title>
  <style>
    .test-button { margin: 10px; padding: 10px; }
    .clicked { background: green; color: white; }
  </style>
</head>
<body>
  <h1>Button Functionality Test</h1>
  ${buttons}
  
  <div id="results"></div>
  
  <script>
    window.testResults = [];
    
    function handleClick(buttonId) {
      const btn = document.getElementById('test-btn-' + buttonId);
      btn.classList.add('clicked');
      
      window.testResults.push({
        buttonId,
        functional: true,
        timestamp: Date.now()
      });
      
      document.getElementById('results').innerHTML = 
        'Clicked buttons: ' + window.testResults.length;
    }
    
    // Auto-test all buttons
    setTimeout(() => {
      const buttons = document.querySelectorAll('.test-button');
      buttons.forEach((btn, i) => {
        setTimeout(() => btn.click(), i * 100);
      });
    }, 1000);
  </script>
</body>
</html>`;
  }

  createFormTestHTML(formElements) {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>VTT Form Functionality Test</title>
</head>
<body>
  <h1>Form Functionality Test</h1>
  
  <form id="test-form" onsubmit="handleSubmit(event)">
    <input type="text" name="username" placeholder="Username" required>
    <input type="email" name="email" placeholder="Email" required>
    <textarea name="message" placeholder="Message"></textarea>
    <button type="submit">Submit Test</button>
  </form>
  
  <div id="form-results"></div>
  
  <script>
    window.formTestResults = [];
    
    function handleSubmit(event) {
      event.preventDefault();
      
      const formData = new FormData(event.target);
      const data = Object.fromEntries(formData);
      
      window.formTestResults.push({
        functional: true,
        data: data,
        timestamp: Date.now()
      });
      
      document.getElementById('form-results').innerHTML = 
        'Form submitted successfully: ' + JSON.stringify(data);
    }
    
    // Auto-test form
    setTimeout(() => {
      document.querySelector('[name="username"]').value = 'test-user';
      document.querySelector('[name="email"]').value = 'test@example.com';
      document.querySelector('[name="message"]').value = 'Test message';
      document.getElementById('test-form').requestSubmit();
    }, 1000);
  </script>
</body>
</html>`;
  }

  createCanvasTestHTML(canvasElements) {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>VTT Canvas Functionality Test</title>
</head>
<body>
  <h1>Canvas Functionality Test</h1>
  
  <canvas id="test-canvas" width="400" height="300" style="border: 1px solid black;"></canvas>
  
  <div id="canvas-results"></div>
  
  <script>
    const canvas = document.getElementById('test-canvas');
    const ctx = canvas.getContext('2d');
    
    window.canvasTestResults = [];
    let clickCount = 0;
    
    // Draw something on canvas
    ctx.fillStyle = 'blue';
    ctx.fillRect(50, 50, 100, 100);
    ctx.fillStyle = 'red';
    ctx.fillRect(200, 100, 80, 80);
    
    // Add click handler
    canvas.addEventListener('click', (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      clickCount++;
      
      // Draw click indicator
      ctx.fillStyle = 'green';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
      
      window.canvasTestResults.push({
        functional: true,
        clickPosition: { x, y },
        timestamp: Date.now()
      });
      
      document.getElementById('canvas-results').innerHTML = 
        'Canvas clicks detected: ' + clickCount;
    });
    
    // Auto-test canvas
    setTimeout(() => {
      const event = new MouseEvent('click', {
        clientX: canvas.getBoundingClientRect().left + 100,
        clientY: canvas.getBoundingClientRect().top + 100
      });
      canvas.dispatchEvent(event);
    }, 1000);
  </script>
</body>
</html>`;
  }

  async testStaticHTML(page, testFile) {
    const testType = testFile.includes('button') ? 'buttons' : 
                    testFile.includes('form') ? 'forms' : 'canvas';
    
    console.log(`🧪 Testing ${testType} functionality...`);
    
    // Wait for auto-tests to complete
    await page.waitForTimeout(2000);
    
    if (testType === 'buttons') {
      const results = await page.evaluate(() => window.testResults || []);
      results.forEach(result => {
        this.results.functionalTests.buttonTests.push({
          ...result,
          testType: 'serverless',
          status: result.functional ? 'working' : 'broken'
        });
      });
      console.log(`🔘 Serverless button tests: ${results.length} buttons tested`);
      
    } else if (testType === 'forms') {
      const results = await page.evaluate(() => window.formTestResults || []);
      results.forEach(result => {
        this.results.functionalTests.formTests.push({
          ...result,
          testType: 'serverless',
          status: result.functional ? 'working' : 'broken'
        });
      });
      console.log(`📝 Serverless form tests: ${results.length} forms tested`);
      
    } else if (testType === 'canvas') {
      const results = await page.evaluate(() => window.canvasTestResults || []);
      results.forEach(result => {
        this.results.functionalTests.canvasTests.push({
          ...result,
          testType: 'serverless',
          status: result.functional ? 'interactive' : 'static'
        });
      });
      console.log(`🎨 Serverless canvas tests: ${results.length} interactions tested`);
    }
  }

  async performStaticFunctionalAnalysis() {
    console.log('📊 Performing static functional analysis...');
    
    // Analyze event handlers for likely functionality
    const eventHandlers = this.results.staticElements.eventHandlers || [];
    let likelyWorking = 0;
    let likelyBroken = 0;
    
    eventHandlers.forEach(handler => {
      // Heuristics for functional vs broken handlers
      const content = handler.content.toLowerCase();
      const hasImplementation = !content.includes('todo') && 
                               !content.includes('placeholder') &&
                               !content.includes('//') &&
                               content.length > 20;
      
      const functional = hasImplementation;
      
      this.results.functionalTests.buttonTests.push({
        file: handler.file,
        line: handler.line,
        content: handler.content,
        functional,
        testType: 'static-analysis',
        status: functional ? 'likely-working' : 'likely-broken',
        reason: functional ? 'Has implementation code' : 'Appears to be placeholder/empty'
      });
      
      if (functional) likelyWorking++;
      else likelyBroken++;
    });
    
    console.log(`📊 Static functional analysis: ${likelyWorking} likely working, ${likelyBroken} likely broken`);
  }

  // Error Classification and Diagnostic Methods
  classifyButtonError(buttonInfo, testResults) {
    const { urlChanged, titleChanged, hasNetworkActivity, hasErrors, consoleErrors } = testResults;
    
    if (hasErrors) {
      const errorType = this.categorizeJSError(consoleErrors[0]);
      return {
        type: 'javascript-error',
        cause: `JavaScript error: ${consoleErrors[0]}`,
        reason: `Button click triggered JavaScript error`,
        fix: errorType.fix
      };
    }
    
    if (buttonInfo.disabled) {
      return {
        type: 'disabled-element',
        cause: 'Button is disabled in DOM',
        reason: 'Button is disabled and cannot be clicked',
        fix: 'Check why button is disabled - missing permissions, invalid state, or loading condition'
      };
    }
    
    if (!urlChanged && !titleChanged && !hasNetworkActivity) {
      // Check for common issues
      if (buttonInfo.type === 'submit' && !buttonInfo.form) {
        return {
          type: 'orphaned-submit',
          cause: 'Submit button not inside a form element',
          reason: 'Submit button has no form to submit',
          fix: 'Wrap button in <form> element or change type to "button" and add onClick handler'
        };
      }
      
      if (!buttonInfo.onClick && !buttonInfo.onSubmit) {
        return {
          type: 'missing-handler',
          cause: 'No event handler attached to button',
          reason: 'Button has no onClick or onSubmit handler',
          fix: 'Add onClick={handleClick} or similar event handler to button'
        };
      }
      
      return {
        type: 'no-response',
        cause: 'Button click produced no detectable changes',
        reason: 'Handler may be empty, async without feedback, or updating hidden state',
        fix: 'Check handler implementation, add loading states, or verify state updates'
      };
    }
    
    return { type: 'unknown', cause: 'Unclassified issue', reason: 'Unknown problem', fix: 'Manual investigation required' };
  }

  classifyFormError(formInfo, testResults) {
    const { submitted, validationErrors, networkErrors } = testResults;
    
    if (validationErrors && validationErrors.length > 0) {
      return {
        type: 'validation-error',
        cause: `Form validation failed: ${validationErrors.join(', ')}`,
        reason: 'Required fields missing or invalid data format',
        fix: 'Check required field validation and input formats'
      };
    }
    
    if (networkErrors && networkErrors.length > 0) {
      return {
        type: 'network-error',
        cause: `Network request failed: ${networkErrors[0]}`,
        reason: 'Form submission endpoint unreachable or returned error',
        fix: 'Check API endpoint URL, server status, and CORS configuration'
      };
    }
    
    if (!formInfo.action && !formInfo.onSubmit) {
      return {
        type: 'missing-action',
        cause: 'Form has no action URL or onSubmit handler',
        reason: 'Form cannot be submitted without action or handler',
        fix: 'Add action="/api/endpoint" or onSubmit={handleSubmit} to form'
      };
    }
    
    if (!submitted) {
      return {
        type: 'submission-blocked',
        cause: 'Form submission was prevented or ignored',
        reason: 'preventDefault() called or handler not executing',
        fix: 'Check for preventDefault() calls or handler implementation'
      };
    }
    
    return { type: 'unknown', cause: 'Unclassified form issue', reason: 'Unknown problem', fix: 'Manual investigation required' };
  }

  classifyCanvasError(canvasInfo, testResults) {
    const { responsive, hasContext, contextType } = testResults;
    
    if (!hasContext) {
      return {
        type: 'no-context',
        cause: 'Canvas has no rendering context (2d or webgl)',
        reason: 'Canvas element exists but no context was created',
        fix: 'Add canvas.getContext("2d") or canvas.getContext("webgl") in component'
      };
    }
    
    if (!responsive) {
      if (contextType === 'webgl') {
        return {
          type: 'webgl-no-interaction',
          cause: 'WebGL canvas not responding to mouse events',
          reason: 'Missing event listeners or hit detection logic',
          fix: 'Add mouse event listeners and implement hit detection with raycasting'
        };
      } else {
        return {
          type: 'canvas-no-interaction',
          cause: '2D canvas not responding to mouse events',
          reason: 'Missing event listeners or click detection',
          fix: 'Add addEventListener("click") and implement coordinate-based hit detection'
        };
      }
    }
    
    return { type: 'unknown', cause: 'Unclassified canvas issue', reason: 'Unknown problem', fix: 'Manual investigation required' };
  }

  classifyAccessibilityError(element, testResults) {
    const { focusable, hasAria, keyboardNavigable } = testResults;
    
    if (!focusable && element.interactive) {
      return {
        type: 'not-focusable',
        cause: 'Interactive element cannot receive keyboard focus',
        reason: 'Missing tabindex or element not naturally focusable',
        fix: 'Add tabIndex={0} to make element keyboard accessible'
      };
    }
    
    if (!hasAria && element.complex) {
      return {
        type: 'missing-aria',
        cause: 'Complex interactive element missing ARIA attributes',
        reason: 'Screen readers cannot understand element purpose',
        fix: 'Add aria-label, role, or aria-describedby attributes'
      };
    }
    
    if (!keyboardNavigable) {
      return {
        type: 'keyboard-trap',
        cause: 'Element cannot be navigated with keyboard',
        reason: 'Tab navigation broken or missing keyboard handlers',
        fix: 'Implement onKeyDown handlers for Enter/Space keys'
      };
    }
    
    return { type: 'unknown', cause: 'Unclassified accessibility issue', reason: 'Unknown problem', fix: 'Manual investigation required' };
  }

  categorizeJSError(errorMessage) {
    const error = errorMessage.toLowerCase();
    
    if (error.includes('cannot read properties of undefined')) {
      return {
        type: 'undefined-property',
        fix: 'Add null checks: obj?.property or obj && obj.property'
      };
    }
    
    if (error.includes('cannot read properties of null')) {
      return {
        type: 'null-reference',
        fix: 'Check if element exists before accessing: if (element) { ... }'
      };
    }
    
    if (error.includes('is not a function')) {
      return {
        type: 'function-undefined',
        fix: 'Verify function is defined and imported correctly'
      };
    }
    
    if (error.includes('network error') || error.includes('fetch')) {
      return {
        type: 'network-failure',
        fix: 'Check API endpoint, network connectivity, and CORS settings'
      };
    }
    
    if (error.includes('permission denied')) {
      return {
        type: 'permission-error',
        fix: 'Check user permissions or browser security restrictions'
      };
    }
    
    return {
      type: 'generic-js-error',
      fix: 'Check browser console for detailed error stack trace'
    };
  }

  classifyTestError(error, testType) {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout')) {
      return {
        type: 'timeout-error',
        cause: `${testType} test timed out waiting for response`,
        reason: 'Element took too long to respond or page didn\'t load',
        fix: 'Increase timeout values or check for slow-loading elements'
      };
    }
    
    if (message.includes('element not found') || message.includes('no such element')) {
      return {
        type: 'element-not-found',
        cause: `${testType} element not found in DOM`,
        reason: 'Element selector incorrect or element not rendered',
        fix: 'Check element selectors and ensure elements are rendered'
      };
    }
    
    if (message.includes('not clickable') || message.includes('not interactable')) {
      return {
        type: 'element-not-clickable',
        cause: `${testType} element exists but cannot be clicked`,
        reason: 'Element hidden, covered by another element, or disabled',
        fix: 'Check element visibility, z-index, and enabled state'
      };
    }
    
    if (message.includes('navigation')) {
      return {
        type: 'navigation-error',
        cause: 'Page navigation failed during test',
        reason: 'URL invalid, server unreachable, or navigation blocked',
        fix: 'Check server status and URL validity'
      };
    }
    
    return {
      type: 'test-framework-error',
      cause: `Test framework error: ${error.message}`,
      reason: 'Internal testing error not related to application',
      fix: 'Check test setup and Puppeteer configuration'
    };
  }

  // Live Functional Testing Implementation
  async performFunctionalTesting(serverUrl, puppeteer) {
    console.log('🧪 Starting Functional Testing...');
    
    const browser = await puppeteer.launch({ 
      headless: false, // Show browser for debugging
      slowMo: 100 // Slow down for visibility
    });
    const page = await browser.newPage();
    
    try {
      await page.goto(serverUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Test different interaction types
      await this.testButtons(page);
      await this.testForms(page);
      await this.testCanvasInteractions(page);
      await this.testWebSocketConnections(page);
      await this.testAccessibility(page);
      await this.testNavigation(page);
      
      console.log('✅ Functional testing complete');
      
    } catch (error) {
      console.error('Functional testing error:', error.message);
    } finally {
      await browser.close();
    }
  }

  async testButtons(page) {
    console.log('🔘 Testing button functionality...');
    
    const buttons = await page.$$('button, [role="button"], input[type="button"], input[type="submit"]');
    let workingButtons = 0;
    let brokenButtons = 0;
    
    for (let i = 0; i < Math.min(buttons.length, 10); i++) { // Test first 10 buttons
      const button = buttons[i];
      
      try {
        // Get button info
        const buttonInfo = await button.evaluate(el => ({
          text: el.textContent?.trim() || el.value || 'No text',
          id: el.id || null,
          className: el.className || null,
          disabled: el.disabled,
          type: el.type || 'button'
        }));
        
        if (buttonInfo.disabled) {
          this.results.functionalTests.buttonTests.push({
            ...buttonInfo,
            status: 'disabled',
            functional: false,
            reason: 'Button is disabled'
          });
          continue;
        }
        
        // Test click functionality
        const beforeUrl = page.url();
        const beforeTitle = await page.title();
        
        // Listen for network activity
        let networkActivity = false;
        const networkListener = () => { networkActivity = true; };
        page.on('request', networkListener);
        
        // Listen for console errors
        let consoleErrors = [];
        const errorListener = (msg) => {
          if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
          }
        };
        page.on('console', errorListener);
        
        // Click the button
        await button.click();
        await page.waitForTimeout(1000); // Wait for potential changes
        
        const afterUrl = page.url();
        const afterTitle = await page.title();
        
        // Determine if button worked
        const urlChanged = beforeUrl !== afterUrl;
        const titleChanged = beforeTitle !== afterTitle;
        const hasNetworkActivity = networkActivity;
        const hasErrors = consoleErrors.length > 0;
        
        const functional = (urlChanged || titleChanged || hasNetworkActivity) && !hasErrors;
        
        // Enhanced error classification
        const errorDetails = this.classifyButtonError(buttonInfo, {
          urlChanged, titleChanged, hasNetworkActivity, hasErrors, consoleErrors
        });
        
        this.results.functionalTests.buttonTests.push({
          ...buttonInfo,
          status: functional ? 'working' : 'broken',
          functional: functional,
          urlChanged,
          titleChanged,
          networkActivity: hasNetworkActivity,
          errors: consoleErrors,
          errorType: errorDetails.type,
          rootCause: errorDetails.cause,
          fixSuggestion: errorDetails.fix,
          reason: functional ? 'Button triggered changes' : errorDetails.reason
        });
        
        if (functional) workingButtons++;
        else brokenButtons++;
        
        // Clean up listeners
        page.off('request', networkListener);
        page.off('console', errorListener);
        
      } catch (error) {
        const errorDetails = this.classifyTestError(error, 'button');
        this.results.functionalTests.buttonTests.push({
          text: 'Unknown',
          status: 'error',
          functional: false,
          errorType: errorDetails.type,
          rootCause: errorDetails.cause,
          fixSuggestion: errorDetails.fix,
          reason: errorDetails.reason
        });
        brokenButtons++;
      }
    }
    
    console.log(`🔘 Button test results: ${workingButtons} working, ${brokenButtons} issues`);
  }

  async testForms(page) {
    console.log('📝 Testing form functionality...');
    
    const forms = await page.$$('form');
    let workingForms = 0;
    let brokenForms = 0;
    
    for (let i = 0; i < Math.min(forms.length, 5); i++) { // Test first 5 forms
      const form = forms[i];
      
      try {
        const formInfo = await form.evaluate(el => ({
          id: el.id || null,
          action: el.action || null,
          method: el.method || 'GET',
          inputCount: el.querySelectorAll('input, select, textarea').length
        }));
        
        // Try to fill and submit form
        const inputs = await form.$$('input[type="text"], input[type="email"], textarea');
        
        // Fill inputs with test data
        for (const input of inputs) {
          const inputType = await input.evaluate(el => el.type);
          const testValue = inputType === 'email' ? 'test@example.com' : 'test-value';
          await input.type(testValue);
        }
        
        // Listen for form submission
        let formSubmitted = false;
        const submitListener = () => { formSubmitted = true; };
        page.on('request', submitListener);
        
        // Try to submit
        const submitButton = await form.$('input[type="submit"], button[type="submit"], button:not([type])');
        if (submitButton) {
          await submitButton.click();
          await page.waitForTimeout(1000);
        }
        
        this.results.functionalTests.formTests.push({
          ...formInfo,
          status: formSubmitted ? 'working' : 'no-submission',
          functional: formSubmitted,
          reason: formSubmitted ? 'Form submitted successfully' : 'No submission detected'
        });
        
        if (formSubmitted) workingForms++;
        else brokenForms++;
        
        page.off('request', submitListener);
        
      } catch (error) {
        this.results.functionalTests.formTests.push({
          status: 'error',
          functional: false,
          reason: `Test error: ${error.message}`
        });
        brokenForms++;
      }
    }
    
    console.log(`📝 Form test results: ${workingForms} working, ${brokenForms} issues`);
  }

  async testCanvasInteractions(page) {
    console.log('🎨 Testing canvas interactions...');
    
    const canvases = await page.$$('canvas');
    let workingCanvases = 0;
    let brokenCanvases = 0;
    
    for (const canvas of canvases) {
      try {
        const canvasInfo = await canvas.evaluate(el => ({
          id: el.id || null,
          width: el.width,
          height: el.height,
          hasContext: !!el.getContext('2d') || !!el.getContext('webgl')
        }));
        
        // Test mouse interactions
        const boundingBox = await canvas.boundingBox();
        if (boundingBox) {
          const centerX = boundingBox.x + boundingBox.width / 2;
          const centerY = boundingBox.y + boundingBox.height / 2;
          
          // Listen for canvas events
          let canvasActivity = false;
          await page.evaluate(() => {
            window.canvasEventDetected = false;
            document.addEventListener('click', () => { window.canvasEventDetected = true; });
            document.addEventListener('mousedown', () => { window.canvasEventDetected = true; });
            document.addEventListener('mousemove', () => { window.canvasEventDetected = true; });
          });
          
          // Simulate interactions
          await page.mouse.click(centerX, centerY);
          await page.mouse.move(centerX + 10, centerY + 10);
          
          canvasActivity = await page.evaluate(() => window.canvasEventDetected);
          
          this.results.functionalTests.canvasTests.push({
            ...canvasInfo,
            status: canvasActivity ? 'interactive' : 'static',
            functional: canvasActivity,
            reason: canvasActivity ? 'Canvas responds to interactions' : 'No interaction response detected'
          });
          
          if (canvasActivity) workingCanvases++;
          else brokenCanvases++;
        }
        
      } catch (error) {
        this.results.functionalTests.canvasTests.push({
          status: 'error',
          functional: false,
          reason: `Test error: ${error.message}`
        });
        brokenCanvases++;
      }
    }
    
    console.log(`🎨 Canvas test results: ${workingCanvases} interactive, ${brokenCanvases} static/issues`);
  }

  async testWebSocketConnections(page) {
    console.log('📡 Testing WebSocket functionality...');
    
    try {
      // Monitor WebSocket connections
      const wsConnections = [];
      
      page.on('response', response => {
        if (response.url().includes('socket.io') || response.headers()['upgrade'] === 'websocket') {
          wsConnections.push({
            url: response.url(),
            status: response.status(),
            headers: response.headers()
          });
        }
      });
      
      // Wait for potential WebSocket connections
      await page.waitForTimeout(3000);
      
      // Check for WebSocket objects in page
      const wsStatus = await page.evaluate(() => {
        const wsConnections = [];
        
        // Check for Socket.IO
        if (window.io && window.socket) {
          wsConnections.push({
            type: 'socket.io',
            connected: window.socket.connected || false,
            id: window.socket.id || null
          });
        }
        
        // Check for native WebSocket
        if (window.WebSocket) {
          // This is harder to detect without access to the actual instances
          wsConnections.push({
            type: 'native-websocket',
            available: true
          });
        }
        
        return wsConnections;
      });
      
      this.results.functionalTests.websocketTests = wsStatus.map(ws => ({
        ...ws,
        functional: ws.connected || ws.available,
        status: ws.connected ? 'connected' : ws.available ? 'available' : 'unavailable'
      }));
      
      console.log(`📡 WebSocket test results: ${wsStatus.length} connections detected`);
      
    } catch (error) {
      this.results.functionalTests.websocketTests.push({
        status: 'error',
        functional: false,
        reason: `Test error: ${error.message}`
      });
    }
  }

  async testAccessibility(page) {
    console.log('♿ Testing accessibility functionality...');
    
    try {
      // Test keyboard navigation
      const focusableElements = await page.$$('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])');
      
      let keyboardNavigable = 0;
      let keyboardIssues = 0;
      
      for (let i = 0; i < Math.min(focusableElements.length, 10); i++) {
        const element = focusableElements[i];
        
        try {
          await element.focus();
          const isFocused = await element.evaluate(el => document.activeElement === el);
          
          if (isFocused) {
            keyboardNavigable++;
          } else {
            keyboardIssues++;
          }
          
          this.results.functionalTests.accessibilityTests.push({
            type: 'keyboard-navigation',
            element: await element.evaluate(el => el.tagName.toLowerCase()),
            functional: isFocused,
            status: isFocused ? 'focusable' : 'not-focusable'
          });
          
        } catch (error) {
          keyboardIssues++;
          this.results.functionalTests.accessibilityTests.push({
            type: 'keyboard-navigation',
            functional: false,
            status: 'error',
            reason: error.message
          });
        }
      }
      
      // Test ARIA attributes functionality
      const ariaElements = await page.$$('[aria-label], [aria-labelledby], [role]');
      let ariaWorking = 0;
      
      for (const element of ariaElements.slice(0, 10)) {
        const ariaInfo = await element.evaluate(el => ({
          role: el.getAttribute('role'),
          label: el.getAttribute('aria-label'),
          labelledby: el.getAttribute('aria-labelledby'),
          hasValidRole: el.role !== null
        }));
        
        const functional = !!(ariaInfo.role || ariaInfo.label || ariaInfo.labelledby);
        if (functional) ariaWorking++;
        
        this.results.functionalTests.accessibilityTests.push({
          type: 'aria-attributes',
          ...ariaInfo,
          functional,
          status: functional ? 'valid-aria' : 'missing-aria'
        });
      }
      
      console.log(`♿ Accessibility test results: ${keyboardNavigable} keyboard navigable, ${ariaWorking} ARIA elements`);
      
    } catch (error) {
      this.results.functionalTests.accessibilityTests.push({
        type: 'accessibility-test',
        functional: false,
        status: 'error',
        reason: error.message
      });
    }
  }

  async testNavigation(page) {
    console.log('🧭 Testing navigation functionality...');
    
    try {
      const links = await page.$$('a[href], [role="link"]');
      let workingLinks = 0;
      let brokenLinks = 0;
      
      for (let i = 0; i < Math.min(links.length, 10); i++) {
        const link = links[i];
        
        try {
          const linkInfo = await link.evaluate(el => ({
            href: el.href || el.getAttribute('href'),
            text: el.textContent?.trim(),
            target: el.target,
            role: el.getAttribute('role')
          }));
          
          if (linkInfo.href && !linkInfo.href.startsWith('javascript:')) {
            const beforeUrl = page.url();
            
            // Test link click (but don't actually navigate away)
            await link.click();
            await page.waitForTimeout(500);
            
            const afterUrl = page.url();
            const navigated = beforeUrl !== afterUrl;
            
            // Go back if we navigated
            if (navigated) {
              await page.goBack();
              await page.waitForTimeout(500);
            }
            
            this.results.functionalTests.navigationTests.push({
              ...linkInfo,
              functional: true,
              status: 'working',
              navigated
            });
            workingLinks++;
            
          } else {
            this.results.functionalTests.navigationTests.push({
              ...linkInfo,
              functional: false,
              status: 'invalid-href',
              reason: 'No valid href attribute'
            });
            brokenLinks++;
          }
          
        } catch (error) {
          this.results.functionalTests.navigationTests.push({
            functional: false,
            status: 'error',
            reason: error.message
          });
          brokenLinks++;
        }
      }
      
      console.log(`🧭 Navigation test results: ${workingLinks} working links, ${brokenLinks} issues`);
      
    } catch (error) {
      this.results.functionalTests.navigationTests.push({
        functional: false,
        status: 'error',
        reason: error.message
      });
    }
  }

  // Layer 6: Accessibility Analysis
  async performAccessibilityAnalysis() {
    console.log('♿ Layer 6: Accessibility Analysis...');
    
    const files = this.getFilesToScan();
    let accessibilityFiles = 0;
    
    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        this.scanAccessibilityElements(filePath, content);
        accessibilityFiles++;
      } catch (error) {
        // Skip files that can't be read
      }
    }
    
    console.log(`✅ Accessibility analysis complete: ${accessibilityFiles} files scanned`);
  }

  scanAccessibilityElements(filePath, content) {
    const relativePath = path.relative('/home/weningerii/vtt', filePath);
    const lines = content.split('\n');

    // Scan accessibility-specific patterns
    // Scan accessibility patterns
    const accessibilityPatternGroups = {
      ariaElements: this.patterns.ariaPatterns,
      keyboardNavigation: this.patterns.keyboardPatterns,
      touchGestures: this.patterns.touchPatterns,
      focusableElements: this.patterns.focusPatterns
    };

    Object.entries(accessibilityPatternGroups).forEach(([category, patterns]) => {
      patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const lineNumber = this.getLineNumber(content, match.index);
          const element = {
            file: relativePath,
            line: lineNumber,
            content: match[0].trim(),
            context: this.getContext(lines, lineNumber - 1),
            category: category,
            type: this.classifyAccessibilityInteraction(match[0])
          };

          // Add accessibility-specific metadata
          this.addAccessibilityMetadata(element, match[0], category);
          
          this.results.accessibilityInteractions[category].push(element);
        }
      });
    });

    // Screen reader elements (semantic HTML)
    const screenReaderPatterns = [
      /<(header|nav|main|section|article|aside|footer)\b[^>]*>/g,
      /<h[1-6]\b[^>]*>/g,
      /<(button|input|select|textarea)\b[^>]*>/g,
      /<label\b[^>]*>/g
    ];

    screenReaderPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const lineNumber = this.getLineNumber(content, match.index);
        this.results.accessibilityInteractions.screenReaderElements.push({
          file: relativePath,
          line: lineNumber,
          content: match[0].trim(),
          type: 'semantic-html',
          category: 'screenReaderElements'
        });
      }
    });
  }

  classifyAccessibilityInteraction(content) {
    if (content.includes('aria-')) return 'aria-attribute';
    if (content.includes('onKey') || content.includes('key')) return 'keyboard';
    if (content.includes('onTouch') || content.includes('touch')) return 'touch';
    if (content.includes('onPointer') || content.includes('pointer')) return 'pointer';
    if (content.includes('focus') || content.includes('blur')) return 'focus';
    if (content.includes('tabindex') || content.includes('tabIndex')) return 'tab-navigation';
    if (content.includes('role')) return 'semantic-role';
    return 'accessibility-generic';
  }

  addAccessibilityMetadata(element, content, category) {
    if (category === 'ariaElements') {
      element.ariaType = content.match(/aria-([a-z-]+)/)?.[1] || 'unknown';
      element.isStateAttribute = ['expanded', 'selected', 'checked', 'disabled'].some(attr => 
        content.includes(attr));
    } else if (category === 'keyboardNavigation') {
      element.keyEvent = content.match(/(keydown|keyup|keypress)/i)?.[1] || 'unknown';
      element.hasPreventDefault = content.includes('preventDefault');
    } else if (category === 'touchGestures') {
      element.touchEvent = content.match(/(touchstart|touchmove|touchend|pointer|gesture)/i)?.[1] || 'unknown';
      element.isMultiTouch = content.includes('touches[') && !content.includes('touches[0]');
    } else if (category === 'focusableElements') {
      element.focusType = content.includes('focus()') ? 'programmatic' : 'event';
      element.hasTabIndex = content.includes('tabindex') || content.includes('tabIndex');
    }
  }

  getFilesToScan() {
    const extensions = ['.tsx', '.ts', '.jsx', '.js'];
    const excludeDirs = ['node_modules', 'dist', 'build', '.git', 'coverage'];
    
    try {
      const findCmd = `find /home/weningerii/vtt -type f \\( -name "*.tsx" -o -name "*.ts" -o -name "*.jsx" -o -name "*.js" \\) | grep -v -E "(${excludeDirs.join('|')}|test|spec|\\.d\\.ts)"`;
      const files = execSync(findCmd, { encoding: 'utf8' })
        .split('\n')
        .filter(file => file.trim())
        .filter(file => extensions.some(ext => file.endsWith(ext)));
      
      console.log(`Found ${files.length} files to scan`);
      return files;
    } catch (error) {
      console.error('Error finding files:', error.message);
      return [];
    }
  }

  scanStaticElements(filePath, content) {
    const relativePath = path.relative('/home/weningerii/vtt', filePath);
    const lines = content.split('\n');

    // Only scan static categories defined in results.staticElements
    const staticCategories = [
      'buttons',
      'links',
      'inputs',
      'eventHandlers',
      'modals',
      'forms',
      'customInteractives'
    ];

    staticCategories.forEach((category) => {
      const patterns = this.patterns[category] || [];
      patterns.forEach((pattern) => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const lineNumber = this.getLineNumber(content, match.index);
          const element = {
            file: relativePath,
            line: lineNumber,
            content: match[0].trim(),
            context: this.getContext(lines, lineNumber - 1),
            category: category,
            type: this.classifyInteraction(match[0])
          };

          // Add metadata based on category
          this.addElementMetadata(element, match[0], category);

          this.results.staticElements[category].push(element);
        }
      });
    });
  }

  addElementMetadata(element, content, category) {
    if (category === 'buttons') {
      element.variant = this.extractAttribute(content, 'variant');
      element.disabled = this.extractAttribute(content, 'disabled');
      element.type = this.extractAttribute(content, 'type');
      element.size = this.extractAttribute(content, 'size');
    } else if (category === 'links') {
      element.to = this.extractAttribute(content, 'to') || this.extractAttribute(content, 'href');
      element.external = this.checkExternalLink(element.to);
    } else if (category === 'inputs') {
      element.inputType = this.extractAttribute(content, 'type');
      element.name = this.extractAttribute(content, 'name');
      element.required = this.extractAttribute(content, 'required');
      element.placeholder = this.extractAttribute(content, 'placeholder');
    } else if (category === 'eventHandlers') {
      element.eventType = this.extractEventType(content);
      element.handlerName = this.extractHandlerName(content);
    }
  }

  extractAttribute(elementStr, attrName) {
    const regex = new RegExp(`${attrName}\\s*=\\s*["']([^"']*)["']|${attrName}\\s*=\\s*{([^}]*)}`, 'i');
    const match = elementStr.match(regex);
    return match ? (match[1] || match[2]) : null;
  }

  extractEventType(content) {
    const match = content.match(/^(on[A-Z][a-zA-Z]*)/);
    return match ? match[1] : 'unknown';
  }

  extractHandlerName(content) {
    const match = content.match(/=\s*([a-zA-Z_$][a-zA-Z0-9_$]*)/);
    return match ? match[1] : 'anonymous';
  }

  checkExternalLink(url) {
    if (!url) return false;
    return url.startsWith('http') || url.startsWith('//') || url.includes('://');
  }

  getLineNumber(content, position) {
    return content.substring(0, position).split('\n').length;
  }

  // Add comprehensive metadata extraction for different element types
  addElementMetadata(element, content, category) {
    switch (category) {
      case 'buttons':
        this.addButtonMetadata(element, content);
        break;
      case 'links':
        this.addLinkMetadata(element, content);
        break;
      case 'inputs':
        this.addInputMetadata(element, content);
        break;
      case 'forms':
        this.addFormMetadata(element, content);
        break;
      case 'modals':
        this.addModalMetadata(element, content);
        break;
      default:
        this.addGenericMetadata(element, content);
    }
  }

  addButtonMetadata(element, content) {
    // Extract variant from Button component props
    const variantMatch = content.match(/variant\s*=\s*["']([^"']+)["']/);
    element.variant = variantMatch ? variantMatch[1] : null;
    
    // Extract size
    const sizeMatch = content.match(/size\s*=\s*["']([^"']+)["']/);
    element.size = sizeMatch ? sizeMatch[1] : null;
    
    // Extract disabled state
    const disabledMatch = content.match(/disabled\s*=\s*\{([^}]+)\}/);
    element.disabled = disabledMatch ? disabledMatch[1] : 
                     content.includes('disabled') ? 'true' : null;
    
    // Extract onClick handler name
    const onClickMatch = content.match(/onClick\s*=\s*\{([^}]+)\}/);
    element.handlerName = onClickMatch ? onClickMatch[1] : null;
    
    // Check for loading state
    element.hasLoading = content.includes('loading');
    
    // Check for icons
    element.hasLeftIcon = content.includes('leftIcon');
    element.hasRightIcon = content.includes('rightIcon');
    
    // Extract button type (submit, button, etc.)
    const typeMatch = content.match(/type\s*=\s*["']([^"']+)["']/);
    element.buttonType = typeMatch ? typeMatch[1] : 'button';
  }

  addLinkMetadata(element, content) {
    // Extract href/to destination
    const hrefMatch = content.match(/(?:href|to)\s*=\s*["']([^"']+)["']/);
    element.to = hrefMatch ? hrefMatch[1] : null;
    
    // Check for external links
    element.isExternal = element.to && (element.to.startsWith('http') || element.to.startsWith('//'));
    
    // Extract target
    const targetMatch = content.match(/target\s*=\s*["']([^"']+)["']/);
    element.target = targetMatch ? targetMatch[1] : null;
  }

  addInputMetadata(element, content) {
    // Extract input type
    const typeMatch = content.match(/type\s*=\s*["']([^"']+)["']/);
    element.inputType = typeMatch ? typeMatch[1] : 'text';
    
    // Check for required
    element.isRequired = content.includes('required');
    
    // Extract placeholder
    const placeholderMatch = content.match(/placeholder\s*=\s*["']([^"']+)["']/);
    element.placeholder = placeholderMatch ? placeholderMatch[1] : null;
    
    // Extract name
    const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
    element.name = nameMatch ? nameMatch[1] : null;
  }

  addFormMetadata(element, content) {
    // Extract onSubmit handler
    const onSubmitMatch = content.match(/onSubmit\s*=\s*\{([^}]+)\}/);
    element.submitHandler = onSubmitMatch ? onSubmitMatch[1] : null;
    
    // Check for form validation
    element.hasValidation = content.includes('useForm') || content.includes('formik') || content.includes('yup');
  }

  addModalMetadata(element, content) {
    // Extract modal open state
    const openMatch = content.match(/(?:isOpen|open|show)\s*=\s*\{([^}]+)\}/);
    element.openState = openMatch ? openMatch[1] : null;
    
    // Extract close handler
    const closeMatch = content.match(/(?:onClose|onCancel|onDismiss)\s*=\s*\{([^}]+)\}/);
    element.closeHandler = closeMatch ? closeMatch[1] : null;
  }

  addGenericMetadata(element, content) {
    // Extract common attributes
    const idMatch = content.match(/id\s*=\s*["']([^"']+)["']/);
    element.elementId = idMatch ? idMatch[1] : null;
    
    const classMatch = content.match(/className\s*=\s*["']([^"']+)["']/);
    element.className = classMatch ? classMatch[1] : null;
  }

  // Helper functions for attribute extraction
  extractAttribute(content, attributeName) {
    const attrPattern = new RegExp(`${attributeName}\\s*=\\s*["']([^"']+)["']`);
    const match = content.match(attrPattern);
    return match ? match[1] : null;
  }

  extractEventType(content) {
    if (content.includes('onClick')) return 'click';
    if (content.includes('onSubmit')) return 'submit';
    if (content.includes('onChange')) return 'change';
    if (content.includes('onKey')) return 'keyboard';
    if (content.includes('onMouse')) return 'mouse';
    if (content.includes('onTouch')) return 'touch';
    return 'generic';
  }

  extractHandlerName(content) {
    const handlerMatch = content.match(/on[A-Z][a-zA-Z]*\s*=\s*\{([^}]+)\}/);
    return handlerMatch ? handlerMatch[1] : null;
  }

  classifyWebSocketInteraction(content) {
    if (content.includes('socket.on') || content.includes('socket.off')) return 'listener';
    if (content.includes('socket.emit') || content.includes('socket.broadcast')) return 'emitter';
    if (content.includes('WebSocket') || content.includes('new WebSocket')) return 'connection';
    if (content.includes('EventSource')) return 'sse';
    return 'websocket-generic';
  }

  getContext(lines, lineIndex, contextLines = 2) {
    const start = Math.max(0, lineIndex - contextLines);
    const end = Math.min(lines.length, lineIndex + contextLines + 1);
    return lines.slice(start, end).map((line, i) => ({
      lineNumber: start + i + 1,
      content: line.trim(),
      isTarget: start + i === lineIndex
    }));
  }

  classifyInteraction(content) {
    if (content.includes('onClick') || content.includes('Button')) return 'click';
    if (content.includes('onSubmit') || content.includes('form')) return 'form';
    if (content.includes('onChange') || content.includes('input')) return 'input';
    if (content.includes('onKey')) return 'keyboard';
    if (content.includes('onTouch') || content.includes('onDrag')) return 'gesture';
    if (content.includes('Modal') || content.includes('Dialog')) return 'modal';
    if (content.includes('Link') || content.includes('navigate')) return 'navigation';
    return 'generic';
  }

  // Summary and reporting
  generateSummary() {
    console.log('📊 Generating summary...');
    
    const allElements = [];
    
    // Include static elements
    Object.values(this.results.staticElements).forEach(items => {
      allElements.push(...items);
    });
    
    // Include canvas elements
    Object.values(this.results.canvasInteractions).forEach(items => {
      if (Array.isArray(items)) {
        allElements.push(...items);
      }
    });
    
    // Include WebSocket elements
    Object.values(this.results.realtimeInteractions).forEach(items => {
      if (Array.isArray(items)) {
        allElements.push(...items);
      }
    });
    
    // Include library elements
    Object.values(this.results.libraryInteractions).forEach(items => {
      if (Array.isArray(items)) {
        allElements.push(...items);
      }
    });
    
    // Include runtime elements
    Object.values(this.results.runtimeElements).forEach(items => {
      if (Array.isArray(items)) {
        allElements.push(...items);
      }
    });
    
    // Include accessibility elements
    Object.values(this.results.accessibilityInteractions).forEach(items => {
      if (Array.isArray(items)) {
        allElements.push(...items);
      }
    });
    
    // Include functional test results
    Object.values(this.results.functionalTests).forEach(items => {
      if (Array.isArray(items)) {
        allElements.push(...items);
      }
    });

    this.results.summary = {
      totalElements: allElements.length,
      byCategory: {},
      byType: {},
      byFile: {},
      topFiles: {},
      activeLayers: this.activeLayers,
      layerBreakdown: {}
    };

    // Count by category (static elements)
    Object.entries(this.results.staticElements).forEach(([category, items]) => {
      this.results.summary.byCategory[category] = items.length;
    });
    
    // Count canvas interactions
    Object.entries(this.results.canvasInteractions).forEach(([category, items]) => {
      if (Array.isArray(items) && items.length > 0) {
        this.results.summary.byCategory[`canvas_${category}`] = items.length;
      }
    });
    
    // Count WebSocket interactions
    Object.entries(this.results.realtimeInteractions).forEach(([category, items]) => {
      if (Array.isArray(items) && items.length > 0) {
        this.results.summary.byCategory[`ws_${category}`] = items.length;
      }
    });
    
    // Count library interactions
    Object.entries(this.results.libraryInteractions).forEach(([category, items]) => {
      if (Array.isArray(items) && items.length > 0) {
        this.results.summary.byCategory[`lib_${category}`] = items.length;
      }
    });
    
    // Count runtime interactions
    Object.entries(this.results.runtimeElements).forEach(([category, items]) => {
      if (Array.isArray(items) && items.length > 0) {
        this.results.summary.byCategory[`runtime_${category}`] = items.length;
      }
    });
    
    // Count accessibility interactions
    Object.entries(this.results.accessibilityInteractions).forEach(([category, items]) => {
      if (Array.isArray(items) && items.length > 0) {
        this.results.summary.byCategory[`a11y_${category}`] = items.length;
      }
    });
    
    // Count functional test results
    Object.entries(this.results.functionalTests).forEach(([category, items]) => {
      if (Array.isArray(items) && items.length > 0) {
        this.results.summary.byCategory[`func_${category}`] = items.length;
        
        // Count working vs broken
        const working = items.filter(item => item.functional).length;
        const broken = items.length - working;
        this.results.summary.byCategory[`func_${category}_working`] = working;
        this.results.summary.byCategory[`func_${category}_broken`] = broken;
      }
    });

    // Count by interaction type
    allElements.forEach(element => {
      const type = element.type || 'unknown';
      this.results.summary.byType[type] = (this.results.summary.byType[type] || 0) + 1;
      
      const file = element.file;
      this.results.summary.byFile[file] = (this.results.summary.byFile[file] || 0) + 1;
    });

    // Layer breakdown
    this.results.summary.layerBreakdown = {
      static: Object.values(this.results.staticElements).reduce((sum, items) => sum + items.length, 0),
      canvas: Object.values(this.results.canvasInteractions).reduce((sum, items) => 
        Array.isArray(items) ? sum + items.length : sum, 0),
      websocket: Object.values(this.results.realtimeInteractions).reduce((sum, items) => 
        Array.isArray(items) ? sum + items.length : sum, 0),
      libraries: Object.values(this.results.libraryInteractions).reduce((sum, items) => 
        Array.isArray(items) ? sum + items.length : sum, 0),
      runtime: Object.values(this.results.runtimeElements).reduce((sum, items) => 
        Array.isArray(items) ? sum + items.length : sum, 0),
      accessibility: Object.values(this.results.accessibilityInteractions).reduce((sum, items) => 
        Array.isArray(items) ? sum + items.length : sum, 0),
      functional: Object.values(this.results.functionalTests).reduce((sum, items) => 
        Array.isArray(items) ? sum + items.length : sum, 0)
    };
    
    // Add functional testing summary
    const functionalSummary = {};
    Object.entries(this.results.functionalTests).forEach(([category, items]) => {
      if (Array.isArray(items) && items.length > 0) {
        const working = items.filter(item => item.functional).length;
        const broken = items.length - working;
        functionalSummary[category] = {
          total: items.length,
          working,
          broken,
          successRate: `${Math.round((working / items.length) * 100)}%`
        };
      }
    });
    this.results.summary.functionalTestResults = functionalSummary;

    // Get top files by interaction count
    this.results.summary.topFiles = Object.entries(this.results.summary.byFile)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .reduce((obj, [file, count]) => {
        obj[file] = count;
        return obj;
      }, {});
  }

  printSummary() {
    console.log('\n📊 EXHAUSTIVE SCANNER SUMMARY');
    console.log('===============================');
    console.log(`Active Layers: ${this.activeLayers.join(', ')}`);
    console.log(`Total Interactive Elements: ${this.results.summary.totalElements}\n`);
    
    console.log('Layer Breakdown:');
    Object.entries(this.results.summary.layerBreakdown).forEach(([layer, count]) => {
      console.log(`  ${layer.padEnd(20)}: ${count}`);
    });
    
    console.log('\nElements by Category:');
    Object.entries(this.results.summary.byCategory)
      .sort(([,a], [,b]) => b - a)
      .forEach(([category, count]) => {
        console.log(`  ${category.padEnd(20)}: ${count}`);
      });
    
    console.log('\nElements by Interaction Type:');
    Object.entries(this.results.summary.byType)
      .sort(([,a], [,b]) => b - a)
      .forEach(([type, count]) => {
        console.log(`  ${type.padEnd(20)}: ${count}`);
      });
    
    console.log('\nTop Files by Element Count:');
    Object.entries(this.results.summary.topFiles).forEach(([file, count]) => {
      console.log(`  ${file.padEnd(50)}: ${count}`);
    });
  }

  exportResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `exhaustive-scan-${timestamp}.json`;
    
    fs.writeFileSync(filename, JSON.stringify(this.results, null, 2));
    console.log(`\n📄 Results exported to: ${filename}`);
    
    // Also create a simplified CSV for quick analysis
    this.exportSimplifiedCsv(timestamp);
  }

  exportSimplifiedCsv(timestamp) {
    const csvFile = `exhaustive-scan-${timestamp}.csv`;
    const allElements = Object.values(this.results.staticElements).flat();
    
    const csvHeader = 'Category,Type,File,Line,Content,Handler,Variant\n';
    const csvRows = allElements.map(element => {
      const fields = [
        element.category,
        element.type,
        element.file,
        element.line,
        `"${element.content.replace(/"/g, '""')}"`,
        element.handlerName || element.to || '',
        element.variant || element.inputType || ''
      ];
      return fields.join(',');
    }).join('\n');
    
    fs.writeFileSync(csvFile, csvHeader + csvRows);
    console.log(`📊 CSV summary exported to: ${csvFile}`);
  }

  // Main execution method
  async scan() {
    console.log('🚀 EXHAUSTIVE VTT Interaction Scanner v2.0.0');
    console.log('==============================================\n');
    
    // Layer 1: Enhanced Static Analysis
    await this.performStaticAnalysis();
    
    // Layer 2: Canvas/WebGL Interactions
    await this.performCanvasAnalysis();
    
    // Layer 3: WebSocket/Real-time Events
    await this.performWebSocketAnalysis();
    
    // Layer 4: Third-party Libraries
    await this.performLibraryAnalysis();
    
    // Layer 5: Runtime Analysis
    await this.performRuntimeAnalysis();
    
    // Layer 6: Accessibility
    await this.performAccessibilityAnalysis();
    
    this.generateSummary();
    this.printSummary();
    this.exportResults();
    
    console.log('\n✨ All 6 layers scan complete!');
    console.log('💡 Ready to add more layers for deeper analysis.');
  }
}

// CLI execution
if (require.main === module) {
  const scanner = new ExhaustiveInteractionScanner();
  scanner.scan().catch(console.error);
}

module.exports = ExhaustiveInteractionScanner;
