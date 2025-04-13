import { updateTopicModel } from './topicAnalyzer.js';

console.log('Starting manual topic analysis...');

// Handle any unhandled promise rejections
process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
    process.exit(1);
});

updateTopicModel()
    .then((success) => {
        if (success) {
            console.log('Topic analysis completed successfully');
        } else {
            console.log('Topic analysis completed with warnings');
        }
        process.exit(0);
    })
    .catch(error => {
        console.error('Topic analysis failed:', error);
        process.exit(1);
    });