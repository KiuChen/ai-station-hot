import {refreshPodcasts} from '@aihot/backend/sources/podcasts';
console.log(JSON.stringify(await refreshPodcasts()));
