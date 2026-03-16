#!/usr/bin/env node

// Test script for vibrant color processing
import { 
  processColors, 
  createVibrantColor, 
  generateTexture, 
  getDefaultColors 
} from './hub/rendering/src/utils/imageGenerator.ts';

console.log('🎨 Testing Vibrant Color Processing\n');

// Test 1: Default vibrant colors
console.log('1. Default Vibrant Colors:');
const defaultVibrant = getDefaultColors();
console.log('Primary:', defaultVibrant.dominantColor);
console.log('Accent:', defaultVibrant.accentColor);
console.log('Texture:', defaultVibrant.texturePattern ? 'Generated' : 'None');
console.log('');

// Test 2: Process a sample color (blue)
console.log('2. Processing Blue Color:');
const blueColor = [33, 150, 243]; // Material Blue
const vibrantBlue = processColors(blueColor, { 
  juicyIntensity: 1.0, 
  enableTexture: true 
});
console.log('Input RGB:', blueColor);
console.log('Vibrant Primary:', vibrantBlue.dominantColor);
console.log('Vibrant Accent:', vibrantBlue.accentColor);
console.log('Text Color:', vibrantBlue.textColor);
console.log('Is Dark Text:', vibrantBlue.isDarkText);
console.log('');

// Test 3: Process a warm color (red)
console.log('3. Processing Red Color:');
const redColor = [244, 67, 54]; // Material Red
const vibrantRed = processColors(redColor, { 
  juicyIntensity: 1.2, 
  enableTexture: true 
});
console.log('Input RGB:', redColor);
console.log('Vibrant Primary:', vibrantRed.dominantColor);
console.log('Vibrant Accent:', vibrantRed.accentColor);
console.log('Text Color:', vibrantRed.textColor);
console.log('Is Dark Text:', vibrantRed.isDarkText);
console.log('');

// Test 4: Process a cool color (green)
console.log('4. Processing Green Color:');
const greenColor = [76, 175, 80]; // Material Green
const vibrantGreen = processColors(greenColor, { 
  juicyIntensity: 0.8, 
  enableTexture: false 
});
console.log('Input RGB:', greenColor);
console.log('Vibrant Primary:', vibrantGreen.dominantColor);
console.log('Vibrant Accent:', vibrantGreen.accentColor);
console.log('Text Color:', vibrantGreen.textColor);
console.log('Texture:', vibrantGreen.texturePattern ? 'Generated' : 'Disabled');
console.log('');

// Test 5: Direct vibrant color creation
console.log('5. Direct Vibrant Color Creation:');
const originalColor = [100, 100, 100]; // Gray
const vibrantGray = createVibrantColor(...originalColor, 1.5);
console.log('Input RGB:', originalColor);
console.log('Vibrant RGB:', [vibrantGray.r, vibrantGray.g, vibrantGray.b]);
console.log('');

console.log('✅ Vibrant color processing test completed!');
console.log('');
console.log('💡 Usage Tips:');
console.log('- Vibrant colors are now the DEFAULT behavior');
console.log('- Adjust juicyIntensity (0.5-2.0) for more/less vibrant colors');
console.log('- Set enableTexture: false to disable texture patterns');
console.log('- No environment variables needed - just works!');
