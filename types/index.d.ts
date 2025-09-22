// WildDuck Type Definitions
// These definitions help AI assistants and IDEs understand the codebase structure

import { ObjectId } from 'mongodb';
import { Readable } from 'stream';

export namespace WildDuck {
    // User Types
    export interface User {
        _id: ObjectId;
        username: string;
        password: string;
        address?: string;
        name?: string;
        quota?: number;
        storageUsed: number;
        messages: number;
        pubKey?: string;
        encryptMessages?: boolean;
        encryptForwarded?: boolean;
        created: Date;
        lastLogin?: {
            time: Date;
            ip: string;
            sess: string;
        };
        disabled?: boolean;
        suspended?: boolean;
        metadata?: Record<string, any>;
        tags?: string[];
    }

    // Mailbox Types
    export interface Mailbox {
        _id: ObjectId;
        user: ObjectId;
        path: string;
        uidValidity: number;
        uidNext: number;
        modifyIndex: number;
        specialUse?: '\\Sent' | '\\Trash' | '\\Junk' | '\\Drafts' | '\\Archive';
        subscribed?: boolean;
        retention?: number;
        encryptMessages?: boolean;
        hidden?: boolean;
        total: number;
        unseen: number;
    }

    // Message Types
    export interface Message {
        _id: ObjectId;
        mailbox: ObjectId;
        user: ObjectId;
        uid: number;
        modseq: number;
        size: number;
        flags: string[];
        flagsUpdated?: Date;
        unseen?: boolean;
        searchable?: boolean;
        junk?: boolean;
        thread?: string;
        threadRoot?: string;
        idate: Date;
        hdate?: Date;
        mimeTree: MimeTree;
        envelope?: Envelope;
        bodystructure?: string;
        headers?: Record<string, string | string[]>;
        text?: string;
        html?: string[];
        intro?: string;
        attachments?: Attachment[];
        ha?: boolean;
        exp?: boolean;
        rdate?: number;
        copied?: boolean;
        meta?: {
            events?: Array<{
                action: string;
                time: Date;
            }>;
        };
    }

    // MIME Types
    export interface MimeTree {
        parsedHeader?: Record<string, any>;
        attachmentMap?: Record<string, string>;
        header?: string[];
        body?: boolean | string;
        size?: number;
        childNodes?: MimeTree[];
    }

    export interface Envelope {
        from?: AddressObject[];
        to?: AddressObject[];
        cc?: AddressObject[];
        bcc?: AddressObject[];
        sender?: AddressObject[];
        replyTo?: AddressObject[];
        subject?: string;
        messageId?: string;
        inReplyTo?: string;
        date?: Date;
    }

    export interface AddressObject {
        name?: string;
        address?: string;
    }

    export interface Attachment {
        id: string;
        filename?: string;
        contentType?: string;
        disposition?: string;
        transferEncoding?: string;
        related?: boolean;
        size: number;
        sizeKb?: number;
        cid?: string;
    }

    // Session Types
    export interface IMAPSession {
        id: string;
        user: {
            id: ObjectId;
            username: string;
        };
        state: 'Not Authenticated' | 'Authenticated' | 'Selected';
        selected?: SelectedMailbox;
        socket?: any;
        ip: string;
        secure: boolean;
        clientInfo?: {
            name?: string;
            version?: string;
            vendor?: string;
        };
    }

    export interface SelectedMailbox {
        mailbox: ObjectId;
        path: string;
        uidList: number[];
        modifyIndex: number;
        uidNext: number;
        uidValidity: number;
        exists: number;
        unseen: number;
    }

    // Handler Response Types
    export type IMAPResponse =
        | 'OK'
        | 'NO'
        | 'BAD'
        | 'NONEXISTENT'
        | 'ALREADYEXISTS'
        | 'TRYCREATE'
        | 'OVERQUOTA'
        | 'CANNOT';

    export interface CopyResponse {
        uidValidity: number;
        sourceUid: number[];
        destinationUid: number[];
    }

    // API Types
    export interface APIRequest {
        params: Record<string, any>;
        query: Record<string, any>;
        body: Record<string, any>;
        user?: string | ObjectId;
        role?: string;
        session?: {
            id: string;
            ip: string;
        };
    }

    export interface APIResponse {
        success: boolean;
        error?: string;
        code?: string;
        data?: any;
    }

    export interface PaginatedResponse<T> extends APIResponse {
        results: T[];
        total: number;
        page: number;
        pages?: number;
        nextCursor?: string;
        previousCursor?: string;
    }

    // Database Handler Types
    export interface MessageHandler {
        add(options: MessageAddOptions, callback: (err: Error | null, info?: MessageInfo) => void): void;
        attachmentStorage: AttachmentStorage;
        encryptMessages(pubKey: string, raw: Buffer, callback: (err: Error | null, encrypted?: Buffer) => void): void;
        prepareMessage(options: { raw: Buffer }, callback: (err: Error | null, prepared?: PreparedMessage) => void): void;
        indexer: Indexer;
    }

    export interface MessageAddOptions {
        user: ObjectId;
        mailbox: ObjectId;
        size: number;
        flags?: string[];
        date?: Date;
        raw?: Buffer | Readable;
        mimeTree?: MimeTree;
        envelope?: Envelope;
        bodystructure?: string;
    }

    export interface MessageInfo {
        id: ObjectId;
        uid: number;
        size: number;
        mailbox: ObjectId;
        user: ObjectId;
    }

    export interface PreparedMessage {
        mimeTree: MimeTree;
        size: number;
        bodystructure: string;
        envelope: Envelope;
        headers: Record<string, string | string[]>;
    }

    export interface UserHandler {
        create(options: UserCreateOptions, callback: (err: Error | null, id?: string) => void): void;
        get(user: string | ObjectId, callback: (err: Error | null, userData?: User) => void): void;
        authenticate(username: string, password: string, requiredScope: string, meta: any, callback: AuthCallback): void;
        userCache: UserCache;
    }

    export interface UserCreateOptions {
        username: string;
        password: string;
        address?: string;
        name?: string;
        quota?: number;
        tags?: string[];
        metadata?: Record<string, any>;
    }

    export type AuthCallback = (err: Error | null, authData?: {
        user: ObjectId;
        username: string;
        scope: string;
        require2fa?: boolean;
        requirePasswordChange?: boolean;
    }) => void;

    export interface UserCache {
        get(key: string, callback: (err: Error | null, value?: any) => void): void;
        set(key: string, value: any, ttl: number, callback: (err?: Error) => void): void;
        remove(key: string, callback: (err?: Error) => void): void;
    }

    export interface MailboxHandler {
        create(user: ObjectId, path: string, opts: any, callback: (err: Error | null, status?: boolean | string, id?: ObjectId) => void): void;
        rename(user: ObjectId, mailbox: ObjectId, newPath: string, opts: any, callback: (err: Error | null, status?: boolean | string) => void): void;
        del(user: ObjectId, mailbox: ObjectId, callback: (err: Error | null, status?: boolean | string) => void): void;
    }

    export interface AttachmentStorage {
        get(attachmentId: string, callback: (err: Error | null, attachmentData?: AttachmentData) => void): void;
        create(attachmentStream: Readable, callback: (err: Error | null, hash?: string) => void): void;
        deleteMany(attachmentIds: string[], magic: number, callback: (err?: Error) => void): void;
        deleteManyAsync(attachmentIds: string[], magic: number): Promise<void>;
        updateMany(attachmentIds: string[], count: number, magic: number): Promise<void>;
    }

    export interface AttachmentData {
        contentType: string;
        transferEncoding: string;
        metadata: {
            magic: number;
            [key: string]: any;
        };
        createReadStream(): Readable;
    }

    export interface Indexer {
        getMaildata(mimeTree: MimeTree): any;
        rebuild(mimeTree: MimeTree): { type: 'stream'; value: Readable } | { type: 'buffer'; value: Buffer };
        storeNodeBodies(maildata: any, mimeTree: MimeTree, callback: (err?: Error) => void): void;
    }

    // Task Types
    export interface Task {
        _id: ObjectId;
        user?: ObjectId;
        type: string;
        locked?: boolean;
        lockedUntil?: Date;
        created: Date;
        status: 'queued' | 'processing' | 'completed' | 'failed';
        data: Record<string, any>;
        result?: any;
        error?: string;
    }

    // Webhook Types
    export interface Webhook {
        _id: ObjectId;
        user?: ObjectId;
        type: string[];
        url: string;
        active: boolean;
        created: Date;
        failures?: number;
        lastError?: {
            message: string;
            time: Date;
        };
    }

    // Settings Types
    export interface Settings {
        _id: ObjectId;
        key: string;
        value: any;
        name?: string;
        description?: string;
        updated?: Date;
    }
}