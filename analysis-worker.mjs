import {compareSnapshots,parseSnapshot} from './core.mjs';
self.onmessage = ({data}) => {
  try {self.postMessage({report:compareSnapshots(parseSnapshot(data.before),parseSnapshot(data.after))});}
  catch(error){self.postMessage({error:error instanceof Error?error.message:'Analysis failed.'});}
};
