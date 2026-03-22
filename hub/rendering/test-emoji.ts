/*import { ImageResponse } from "@takumi-rs/image-response";
import React from "react";
import { writeFileSync } from "fs";

async function test() {
  const jsx = React.createElement('div', {
    style: { display: 'flex', padding: '20px', fontSize: '24px' }
  }, 'Test 🇺🇸 flag and ♂️ symbol');
  
  console.log('Input:', 'Test 🇺🇸 flag and ♂️ symbol');
  
  const response = new ImageResponse(jsx, {
    width: 400,
    height: 100,
    emoji: "twemoji",
  });
  
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync('/tmp/emoji-test.png', buffer);
  console.log('Written to /tmp/emoji-test.png, size:', buffer.length);
}

test().catch(e => console.error('Error:', e));*/
