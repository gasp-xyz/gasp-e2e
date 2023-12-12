###  What is this? 
This is an awesome tool that helps you running tedious and repetitive tasks for testing. 
### How to run it?
1.- First, run yarn in mangata-e2e folder
2.- Then , run yarn in cliTool folder
3.- Then use this command to run the tool, 
```
API_URL=ws://localhost:9946 node --experimental-specifier-resolution=node --loader ts-node/esm --experimental-vm-modules cliTool/index.ts --runInBand
```
Any feedback is welcome!
