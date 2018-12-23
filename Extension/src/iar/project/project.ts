'use strict';

import * as Fs from "fs";
import * as Path from "path";
import { Config } from "./config";
import { XmlNode } from "../../utils/XmlNode";
import { FsUtils } from "../../utils/fs";

export interface Project {
    readonly path: Fs.PathLike;
    readonly configurations: ReadonlyArray<Config>;
    readonly name: string;

    reload(): any;
    findConfiguration(name: string): Config | undefined;
}

class EwpFile implements Project {
    private xml: XmlNode;
    private configurations_: Config[];

    readonly path: Fs.PathLike;

    constructor(path: Fs.PathLike) {
        this.path = path;
        this.xml = this.loadXml();
        this.configurations_ = this.loadConfigurations();
    }

    get name(): string {
        return Path.parse(this.path.toString()).name;
    }

    get configurations(): ReadonlyArray<Config> {
        return this.configurations_;
    }

    /**
     * Reload the project file.
     * 
     * \returns {undefined} On success.
     * \returns {any} When an error occured.
     */
    public reload(): any {
        try {
            let xml = this.loadXml();
            let configs = this.loadConfigurations();

            this.xml = xml;
            this.configurations_ = configs;

            return undefined;
        } catch (e) {
            return e;
        }
    }

    public findConfiguration(name: string): Config | undefined {
        let result: Config | undefined = undefined;

        this.configurations.some((config): boolean => {
            if (config.name === name) {
                result = config;
                return true;
            }

            return false;
        });

        return result;
    }

    /**
     * Load the xml file. The `path` property should already be initialized!
     * 
     * We do not assing the result to `xml` directly because we have to disable
     * the lint check. We have to initialize `xml` in the constructor but we
     * like to create a helper function so we can reuse this code when reloading
     * the project file.
     */
    private loadXml(): XmlNode {
        let stat = Fs.statSync(this.path);

        if (!stat.isFile()) {
            throw new Error("'${this.path.toString()}' is not a file!");
        }

        let content = Fs.readFileSync(this.path);

        let node = new XmlNode(content.toString());

        if (node.tagName !== "project") {
            throw new Error("Expected 'project' as root tag");
        }

        return node;
    }

    private loadConfigurations(): Config[] {
        return Config.fromXml(this.xml, this.path);
    }
}

export namespace Project {
    export function createProjectFrom(ewpPath: Fs.PathLike): Project | undefined {
        let stat = Fs.statSync(ewpPath);

        if (!stat.isFile()) {
            return undefined;
        }

        try {
            return new EwpFile(ewpPath);
        } catch (e) {
            return undefined;
        }
    }

    export function createProjectsFrom(directory: Fs.PathLike, recursive: boolean = true): Project[] {
        let projectPaths = findProjectFilesIn(directory, recursive);

        let projects = new Array<Project>();

        projectPaths.forEach(path => {
            let project = createProjectFrom(path);

            if (project) {
                projects.push(project);
            }
        });

        return projects;
    }

    function findProjectFilesIn(directory: Fs.PathLike, recursive: boolean = true): Fs.PathLike[] {
        return FsUtils.walkAndFind(directory, recursive, (path): boolean => {
            let stat = Fs.statSync(path);

            if (stat.isFile()) {
                let extension = Path.parse(path.toString()).ext;

                if (extension === ".ewp") {
                    return true;
                }
            }

            return false;
        });
    }
}
