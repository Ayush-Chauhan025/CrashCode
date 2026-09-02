import { FeedBack } from "./loop";

async function main(){
    const target_file = process.argv[2];
    if(!target_file){
      console.log("No file to Check");
      process.exit(0);
    }
    const loop = new FeedBack();
    await loop.audit_file(target_file);
}

main().catch(err => {
  console.error('execution error:', err);
  process.exit(1);
});