# Juicy Color System Documentation

## Overview

The Juicy Color System transforms the traditional gradient-based coloring approach into vibrant, solid colors with subtle textures. This creates a more modern, "juicy" visual appearance while maintaining excellent text contrast and readability.

## Key Features

### 🎨 Vibrant Solid Colors
- **Enhanced Saturation**: Colors are boosted by 1.4x saturation for vibrancy
- **Warm Temperature**: Colors are shifted toward warmer tones for a more inviting feel
- **Micro-variations**: Subtle hue oscillation (±2°) for organic appearance

### 🌊 Depth Without Gradients
- **SVG Noise Patterns**: Subtle texture overlays for visual depth
- **Smart Shadows**: Inner shadows and overlays for dimension
- **Harmonious Accents**: Split-complementary color theory for accent colors

### 🔄 Backward Compatibility
- **Optional Mode**: Can be enabled globally or per-request
- **Graceful Fallback**: Falls back to gradient system when needed
- **Performance Optimized**: Minimal overhead compared to gradient generation

## Usage

### Default Behavior
Juicy colors are now **enabled by default**. No configuration needed!

### Disable Juicy Mode (if needed)
```javascript
// Disable juicy mode for specific request
const options = {
  juicyMode: false,           // Disable to use traditional gradients
  juicyIntensity: 1.2,        // Only applies when juicyMode is true
  enableTexture: true         // Only applies when juicyMode is true
};

const result = await generateImage(component, props, scaling, i18n, options);
```

### Juicy Mode Options
```javascript
// Customize juicy behavior
const options = {
  juicyMode: true,            // Explicit enable (optional, already default)
  juicyIntensity: 1.2,        // 0.5-2.0, default 1.0
  enableTexture: true         // default true
};
```

### Environment Variable (Legacy)
```bash
# Force disable juicy colors globally (if needed)
JUICY_COLORS_ENABLED=false
```

**Note**: Environment variable is only used for explicit disable. Juicy colors are default enabled.

### Direct Color Processing
```javascript
import { 
  processJuicyColors, 
  createJuicyColor, 
  generateJuicyTexture 
} from './utils/imageGenerator.js';

// Process RGB array to juicy colors
const juicyColors = processJuicyColors([255, 100, 50], {
  juicyIntensity: 1.0,
  enableTexture: true
});

// Create individual juicy color
const juicyColor = createJuicyColor(100, 150, 200, 1.5);

// Generate texture pattern
const texture = generateJuicyTexture();
```

## Color Processing Pipeline

### 1. Color Extraction
- Extract dominant color from user avatar using `color-thief-bun`
- Validate RGB values and handle edge cases

### 2. Juicy Enhancement
```javascript
// Convert to HSL for precise control
const [h, s, l] = rgbToHsl(r, g, b);

// Apply juicy boost
const boostedSaturation = Math.min(100, s * 1.4);
const boostedLightness = Math.min(85, Math.max(15, l + 5));

// Warm up color temperature
let warmHue = h;
if (h >= 180 && h <= 300) {
  warmHue = (h + 15) % 360; // Cool → Warm
} else if (h >= 300 || h <= 60) {
  warmHue = h + 5; // Already warm → enhance
}
```

### 3. Texture Generation
- SVG turbulence filter with configurable parameters
- Base frequency: 0.9 for fine texture
- 4 octaves for natural variation
- 40% opacity for subtle effect

### 4. Accent Color Generation
- Split-complementary color harmony (150° hue shift)
- 80% saturation for contrast without overwhelming
- Adjusted lightness for visual hierarchy

## API Reference

### Functions

#### `processJuicyColors(rgbArray, options)`
Process RGB array into juicy color scheme.

**Parameters:**
- `rgbArray`: `[r, g, b]` - Input color values (0-255)
- `options.juicyIntensity`: `number` - Intensity multiplier (0.5-2.0)
- `options.enableTexture`: `boolean` - Enable texture generation

**Returns:**
```javascript
{
  textColor: string,           // "#000000" or "#FFFFFF"
  secondaryTextColor: string,   // rgba with opacity
  tertiaryTextColor: string,   // rgba with lower opacity
  isDarkText: boolean,         // Text contrast flag
  backgroundGradient: string,  // Solid color (legacy name)
  dominantColor: string,       // Primary juicy color
  secondaryColor: string,      // Accent color
  accentColor: string,         // Additional accent
  texturePattern: string,      // SVG data URI or null
  juicyIntensity: number,       // Applied intensity
  overlayBackground: string,   // Subtle overlay
  embedColor: string          // Discord embed color
}
```

#### `createJuicyColor(r, g, b, intensity)`
Create individual juicy color from RGB values.

#### `generateJuicyTexture(seed)`
Generate SVG texture pattern for depth.

#### `getDefaultJuicyColors()`
Get default juicy color scheme (vibrant orange).

### Environment Variables

- `JUICY_COLORS_ENABLED`: `"false"` - Force disable juicy colors globally
- `JUICY_INTENSITY`: `"1.0"` - Default intensity multiplier

**Note**: Juicy colors are enabled by default. Environment variable only needed for explicit disable.

## Performance Considerations

### Caching
- Color results are cached with TTL (2 hours)
- Texture patterns are generated once per unique seed
- User-specific caching prevents redundant processing

### Memory
- Texture patterns use SVG data URIs (~2KB each)
- Color processing uses minimal additional memory
- Cache eviction prevents memory buildup

### CPU
- HSL conversions are lightweight operations
- SVG generation is fast (<5ms per texture)
- No expensive gradient calculations

## Design Principles

### Color Theory
- **Warm Bias**: Humans prefer warm colors for "juicy" appearance
- **Split-Complementary**: More harmonious than pure complementary
- **Saturation Control**: Prevents neon/oversaturation artifacts

### Accessibility
- **High Contrast**: Maintains WCAG AA contrast ratios
- **Text Readability**: Automatic black/white text selection
- **Color Blind Safe**: Relies on luminance rather than hue alone

### Visual Hierarchy
- **Primary Color**: Main background, most vibrant
- **Accent Color**: Secondary elements, harmonious contrast
- **Text Colors**: Optimized for readability against primary

## Migration Guide

### From Gradients to Juicy
```javascript
// Before (gradient mode - now requires explicit disable)
const options = { juicyMode: false };

// After (juicy mode - now default, no options needed)
const options = {}; // Juicy colors enabled by default

// Or customize juicy behavior
const options = { 
  juicyMode: true,           // Optional, already default
  juicyIntensity: 1.0,
  enableTexture: true
};
```

### Backward Compatibility
- Existing gradient system remains fully functional
- `backgroundGradient` property name preserved for compatibility
- Set `juicyMode: false` to use traditional gradients

### Testing
```bash
# Run juicy color tests
node test-juicy-colors.mjs

# Test with default juicy colors (no env vars needed)
npm run dev
```

## Troubleshooting

### Colors Not "Juicy" Enough
- Increase `juicyIntensity` to 1.2-1.5
- Check input image color extraction
- Verify juicy mode is not explicitly disabled with `juicyMode: false`

### Performance Issues
- Disable texture with `enableTexture: false`
- Reduce cache TTL if memory is constrained
- Monitor cache hit rates

### Text Readability
- Check `isDarkText` flag in results
- Verify luminance calculations
- Test with various input colors

## Examples

### Discord Bot Integration
```javascript
// Juicy colors are enabled by default
const imageBuffer = await generateImage('UserProfile', {
  interaction: ctx.interaction,
  dominantColor: 'user'
}, { image: 2 }, i18n, {
  juicyIntensity: 1.3  // Optional: customize intensity
});

// Disable for traditional gradients if needed
const imageBuffer = await generateImage('UserProfile', {
  interaction: ctx.interaction,
  dominantColor: 'user'
}, { image: 2 }, i18n, {
  juicyMode: false  // Use gradients instead
});
```

### Game UI Components
```javascript
// Juicy colors for game elements
const gameColors = processJuicyColors([playerAvatarColor], {
  juicyIntensity: 1.5,
  enableTexture: true
});
```

### Brand Customization
```javascript
// Custom juicy colors from brand palette
const brandJuicy = createJuicyColor(brandR, brandG, brandB, 1.2);
```
