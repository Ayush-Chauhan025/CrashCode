import {Project, FunctionDeclaration, SyntaxKind} from 'ts-morph';
import { ExtractedFunction } from './types';

export class AST_Parser{
    private project: Project;
    constructor(){
        this.project = new Project({useInMemoryFileSystem: false});
    }

    public extract_exported_function(filepath: string): ExtractedFunction[] {
        const source_file = this.project.addSourceFileAtPath(filepath);
        const functions: ExtractedFunction[] = [];

        source_file.getFunctions().forEach((fn: FunctionDeclaration) => {
            if(fn.isExported()){
                functions.push({
                    name: fn.getName() || 'anonymous',
                    parameters: fn.getParameters().map((p) => ({
                        name: p.getName(),
                        type: p.getType().getText(),
                    })),
                    return_type: fn.getReturnType().getText(),
                    source_code: fn.getText()
                });
            }
        });

        source_file.getVariableStatements().forEach((st) => {
            if(st.isExported()){
                st.getDeclarations().forEach((decl) => {
                    const init = decl.getInitializerIfKind(SyntaxKind.ArrowFunction);
                    if(init){
                        functions.push({
                            name: decl.getName(),
                            parameters: init.getParameters().map(p => ({
                                name: p.getName(),
                                type: p.getType().getText()
                            })),
                            return_type: init.getReturnType().getText(),
                            source_code: decl.getText()
                        });
                    }
                });
            }
        });

        return functions;
    }
}