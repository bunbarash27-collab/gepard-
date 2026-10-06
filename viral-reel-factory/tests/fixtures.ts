/** Complete generator-facing specs, as a schema-valid model response would contain them. */
export const modelImage = () => ({
  subject: 'a woman in a red coat behind the wheel', composition: 'centered medium close-up', cameraAngle: 'eye level through the windshield', lens: '35mm',
  depthOfField: 'shallow, f/2', lighting: 'cold dashboard glow from below', materials: 'worn leather, glass', textures: 'rain droplets on glass', atmosphere: 'quiet tension',
});
export const modelVideo = () => ({
  subjectMovement: 'she shuts the door and freezes', cameraMovement: 'slow push-in', objectMovement: 'wipers stop mid-stroke', facialMovement: 'eyes widen',
  environmentMovement: 'fog rolls past the windows', physicalInteraction: 'hand grips the steering wheel', timing: '0-1s door, 1-3s freeze', transition: 'hard cut', endingFrame: 'her face lit by green light',
});
