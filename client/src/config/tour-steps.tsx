import { Step } from 'react-joyride';

export const editorSteps: Step[] = [
  {
    target: 'body',
    placement: 'center',
    content: (
      <div className="text-left">
        <h3 className="font-bold text-lg mb-2">Welcome to Doculoom! 👋</h3>
        <p>Let's take a quick tour of the editor to get you creating professional spec sheets in minutes.</p>
      </div>
    ),
    disableBeacon: true,
  },
  {
    target: '#tour-catalog-nav', // We will add this ID to LeftPanel later
    content: 'Browse your product catalog here. Drag and drop items directly onto the canvas.',
    placement: 'right',
  },
  {
    target: '#tour-canvas-area', // We will add this ID to DesignCanvas
    content: 'This is your infinite canvas. Arrange elements, resize images, and layout your document.',
    placement: 'top',
  },
  {
    target: '#tour-properties-panel', // We will add this ID to RightPanel
    content: 'Select any element to customize its properties, fonts, and colors here.',
    placement: 'left',
  },
  {
    target: '#tour-export-btn', // We will add this ID to Header
    content: 'Ready to go? Export your design to PDF or share it instantly.',
    placement: 'bottom',
  },
];