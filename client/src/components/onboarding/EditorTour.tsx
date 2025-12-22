import { useState, useEffect } from 'react';
import Joyride, { CallBackProps, STATUS } from 'react-joyride';
import { useTheme } from '@/components/theme-provider'; // Assuming you have a theme provider, or use standard CSS checks
import { editorSteps } from '@/config/tour-steps';

export function EditorTour() {
  const [run, setRun] = useState(false);

  useEffect(() => {
    // Check local storage to see if tour was already completed
    const tourSeen = localStorage.getItem('doculoom_editor_tour_seen');
    if (!tourSeen) {
      setRun(true);
    }
  }, []);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      // Mark tour as seen indefinitely
      localStorage.setItem('doculoom_editor_tour_seen', 'true');
      setRun(false);
    }
  };

  return (
    <Joyride
      steps={editorSteps}
      run={run}
      continuous
      showSkipButton
      showProgress
      callback={handleJoyrideCallback}
      styles={{
        options: {
          // Match your Shadcn/Tailwind colors
          primaryColor: '#0f172a', // slate-900 (adjust to your primary brand color)
          textColor: '#334155',    // slate-700
          backgroundColor: '#ffffff',
          arrowColor: '#ffffff',
          overlayColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
        },
        buttonNext: {
          backgroundColor: 'hsl(var(--primary))',
          color: 'hsl(var(--primary-foreground))',
          borderRadius: 'var(--radius)',
          padding: '8px 16px',
          fontFamily: 'inherit',
          fontWeight: 500,
        },
        buttonBack: {
          color: 'hsl(var(--muted-foreground))',
          marginRight: 10,
          fontFamily: 'inherit',
        },
        buttonSkip: {
            color: 'hsl(var(--muted-foreground))',
        },
        tooltip: {
            borderRadius: 'var(--radius)',
            padding: '20px', 
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
        }
      }}
    />
  );
}