/**
 * WildDuck Email Server Type Definitions
 * Enhanced for AI-assisted development
 */

import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import { RedisClientType } from 'redis';

declare namespace WildDuck {
    // Core interfaces
    interface DatabaseConnections {
        database: Db;
        users?: Db;
        redis: RedisClientType;
        gridfs?: Db;
    }

    interface HandlerOptions extends DatabaseConnections {
        loggelf?: (message: any) => boolean;
        attachmentStorage?: AttachmentStorage;
        attachments?: AttachmentConfig;
        messageHandler?: MessageHandler;
        notifier?: ImapNotifier;
    }

    // User Management
    interface UserData {
        _id: ObjectId;
        username: string;
        name?: string;
        address: string;
        quota?: number;
        storageUsed?: number;
        enabled: boolean;
        suspended: boolean;
        created: Date;
        retention?: number;
        encryptMessages?: boolean;
        encryptForwarded?: boolean;
        pubKey?: string;
        metaData?: Record<string, any>;
        internalData?: Record<string, any>;
        tags?: string[];
        language?: string;
        featureFlags?: FeatureFlag[];
    }

    interface AddressData {
        _id: ObjectId;
        user: ObjectId;
        address: string;
        addrview: string;
        name?: string;
        targets?: ForwardTarget[];
        main?: boolean;
        created: Date;
    }

    interface ForwardTarget {
        id: ObjectId;
        type: 'relay' | 'http' | 'autoreply';
        value: string;
    }

    interface AuthenticationOptions {
        username: string;
        signature?: string;
        nonce?: string;
        create?: boolean;
        requirePasswordChange?: boolean;
        ip?: string;
        sess?: string;
    }

    interface AuthenticationResult {
        user: ObjectId;
        username: string;
        scope: string;
        require2fa?: boolean;
        requirePasswordChange?: boolean;
    }

    // Mailbox Management
    interface MailboxData {
        _id: ObjectId;
        user: ObjectId;
        path: string;
        name: string;
        uidValidity: number;
        uidNext: number;
        modifyIndex: number;
        subscribed: boolean;
        flags: string[];
        retention?: number;
        specialUse?: SpecialUse;
        hidden?: boolean;
        created: Date;
    }

    type SpecialUse = 'Inbox' | 'Sent' | 'Junk' | 'Trash' | 'Drafts' | 'Archive';

    interface MailboxCreateOptions {
        subscribed?: boolean;
        hidden?: boolean;
        retention?: number;
        uidValidity?: number;
    }

    // Message Management
    interface MessageData {
        _id: ObjectId;
        user: ObjectId;
        mailbox: ObjectId;
        uid: number;
        modseq: number;
        idate: Date;
        hdate: Date;
        subject?: string;
        msgid?: string;
        exp?: boolean;
        copied?: boolean;
        thread?: ObjectId;
        flags: string[];
        attachments?: AttachmentInfo[];
        headers: MessageHeader[];
        text?: string;
        html?: string[];
        size: number;
        map?: Record<string, any>;
        outbound?: ObjectId[];
        forwardTargets?: ObjectId[];
    }

    interface MessageHeader {
        key: string;
        line: string;
        value?: string;
    }

    interface AttachmentInfo {
        id: ObjectId;
        filename?: string;
        contentType: string;
        transferEncoding?: string;
        related?: boolean;
        sizeKb: number;
        hash: string;
    }

    interface MessageAddOptions {
        date?: Date;
        flags?: string[];
        raw?: Buffer | string;
        normalizeSubject?: boolean;
        skipAttachments?: boolean;
        sess?: string;
        ip?: string;
    }

    // Blockchain Authentication
    interface BlockchainAuthData {
        type: 'evm' | 'solana' | 'ens' | 'sns';
        address: string;
        resolvedAddress?: string;
        signature: string;
        nonce: string;
        message?: string;
    }

    type BlockchainIdentifier = string; // EVM address, Solana address, ENS/SNS name

    // Configuration
    interface ServerConfig {
        name: string;
        version: string;
        api: ApiConfig;
        imap: ImapConfig;
        pop3: Pop3Config;
        lmtp: LmtpConfig;
        acme: AcmeConfig;
        dbs: DatabaseConfig;
        log: LogConfig;
        processes?: number;
    }

    interface ApiConfig {
        port: number;
        host: string;
        secure: boolean;
        disableVersionHeader?: boolean;
        accessControl?: AccessControlConfig;
        roles?: RoleConfig[];
    }

    interface ImapConfig {
        port: number;
        host: string;
        secure: boolean;
        secured?: boolean;
        disableVersionHeader?: boolean;
        maxConnections: number;
        useProxy?: boolean;
        ignoreTLS?: boolean;
        starttls?: boolean;
    }

    interface Pop3Config {
        port: number;
        host: string;
        secure: boolean;
        secured?: boolean;
        disableVersionHeader?: boolean;
        maxConnections: number;
    }

    interface LmtpConfig {
        enabled: boolean;
        port: number;
        host: string;
        maxConnections: number;
        banner?: string;
    }

    interface AcmeConfig {
        enabled: boolean;
        port: number;
        host: string;
        email: string;
        directoryUrl?: string;
    }

    interface DatabaseConfig {
        mongo: string;
        redis: string;
        sender: string;
        gridfs?: string;
        users?: string;
    }

    interface LogConfig {
        level: string;
        mail?: boolean;
        gelf?: GelfConfig;
    }

    interface GelfConfig {
        enabled: boolean;
        component: string;
        hostname: string;
        host: string;
        port: number;
        facility: string;
    }

    interface AccessControlConfig {
        allowOrigin?: string;
        allowMethods?: string;
        allowHeaders?: string;
    }

    interface RoleConfig {
        role: string;
        resources: string[];
        actions: string[];
    }

    interface AttachmentConfig {
        type: 'gridstore' | 's3';
        bucket?: string;
        prefix?: string;
        decodeBase64?: boolean;
    }

    // Feature Flags
    type FeatureFlag = 'indexing' | string;

    // Error Handling
    interface WildDuckError extends Error {
        code: string;
        responseCode: number;
        details?: Record<string, any>;
    }

    // API Response Types
    interface ApiResponse<T = any> {
        success: boolean;
        id?: string;
        data?: T;
        error?: string;
        code?: string;
    }

    interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
        page: number;
        pages: number;
        total: number;
        nextCursor?: string;
        previousCursor?: string;
    }

    // Handler Classes
    class UserHandler {
        constructor(options: HandlerOptions);
        resolveAddress(address: string, options?: any, callback?: Function): Promise<AddressData> | void;
        asyncResolveAddress(address: string, options?: any): Promise<AddressData>;
        asyncAuthenticate(username: string, signature: string, options?: AuthenticationOptions): Promise<AuthenticationResult>;
        create(userData: Partial<UserData>, callback?: Function): Promise<ObjectId> | void;
        asyncCreate(userData: Partial<UserData>): Promise<ObjectId>;
        delete(user: ObjectId, options?: any, callback?: Function): Promise<boolean> | void;
        asyncDelete(user: ObjectId, options?: any): Promise<boolean>;
        reset(user: ObjectId, options?: any, callback?: Function): Promise<boolean> | void;
        asyncReset(user: ObjectId, options?: any): Promise<boolean>;
    }

    class MessageHandler {
        constructor(options: HandlerOptions);
        add(user: ObjectId, mailbox: ObjectId, message: Buffer | string, options?: MessageAddOptions, callback?: Function): Promise<any> | void;
        asyncAdd(user: ObjectId, mailbox: ObjectId, message: Buffer | string, options?: MessageAddOptions): Promise<any>;
        get(user: ObjectId, mailbox: ObjectId, uid: number, options?: any, callback?: Function): Promise<MessageData> | void;
        asyncGet(user: ObjectId, mailbox: ObjectId, uid: number, options?: any): Promise<MessageData>;
        delete(user: ObjectId, mailbox: ObjectId, uid: number, options?: any, callback?: Function): Promise<boolean> | void;
        asyncDelete(user: ObjectId, mailbox: ObjectId, uid: number, options?: any): Promise<boolean>;
    }

    class MailboxHandler {
        constructor(options: HandlerOptions);
        create(user: ObjectId, path: string, options?: MailboxCreateOptions, callback?: Function): Promise<any> | void;
        createAsync(user: ObjectId, path: string, options?: MailboxCreateOptions): Promise<any>;
        delete(user: ObjectId, mailbox: ObjectId, options?: any, callback?: Function): Promise<boolean> | void;
        deleteAsync(user: ObjectId, mailbox: ObjectId, options?: any): Promise<boolean>;
        rename(user: ObjectId, mailbox: ObjectId, newPath: string, options?: any, callback?: Function): Promise<boolean> | void;
        renameAsync(user: ObjectId, mailbox: ObjectId, newPath: string, options?: any): Promise<boolean>;
    }

    // Utility Classes
    class AttachmentStorage {
        constructor(options: any);
        store(id: ObjectId, attachment: Buffer, callback?: Function): Promise<any> | void;
        get(id: ObjectId, callback?: Function): Promise<Buffer> | void;
        delete(id: ObjectId, callback?: Function): Promise<boolean> | void;
    }

    class ImapNotifier {
        constructor(options: any);
        fire(user: ObjectId, event: string, data?: any): void;
        addEntries(entries: any[]): void;
    }

    // Blockchain Utilities
    function isValidBlockchainIdentifier(identifier: string): boolean;
    function getAuthenticationAddress(identifier: string): Promise<string>;
    function verifySignature(type: string, address: string, signature: string, message: string): Promise<boolean>;
}

export = WildDuck;