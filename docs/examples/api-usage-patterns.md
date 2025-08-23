# WildDuck API Usage Patterns

This guide provides practical examples and patterns for common WildDuck API operations, optimized for AI-assisted development.

## Authentication Patterns

### Blockchain Authentication

#### Ethereum/ENS Authentication
```javascript
const { ethers } = require('ethers');
const axios = require('axios');

class EthereumAuth {
  constructor(privateKey, apiUrl) {
    this.wallet = new ethers.Wallet(privateKey);
    this.apiUrl = apiUrl;
  }

  async authenticate(username) {
    const nonce = ethers.utils.hexlify(ethers.utils.randomBytes(32));
    const domain = new URL(this.apiUrl).hostname;
    
    // Create SIWE message
    const message = `${domain} wants you to sign in with your Ethereum account:
${this.wallet.address}

Welcome to WildDuck Email!

URI: ${this.apiUrl}
Version: 1
Chain ID: 1
Nonce: ${nonce}
Issued At: ${new Date().toISOString()}`;

    // Sign the message
    const signature = await this.wallet.signMessage(message);
    
    // Authenticate with API
    const response = await axios.post(`${this.apiUrl}/authenticate`, {
      username,
      signature,
      nonce,
      create: true
    });
    
    return response.data.token;
  }
}

// Usage
const auth = new EthereumAuth('0x...privatekey', 'https://api.example.com');
const token = await auth.authenticate('vitalik.eth');
```

#### Solana Authentication
```javascript
const { Keypair } = require('@solana/web3.js');
const nacl = require('tweetnacl');
const bs58 = require('bs58');

class SolanaAuth {
  constructor(secretKey, apiUrl) {
    this.keypair = Keypair.fromSecretKey(secretKey);
    this.apiUrl = apiUrl;
  }

  async authenticate(username) {
    const nonce = bs58.encode(nacl.randomBytes(32));
    const message = `Sign in to WildDuck Email
Address: ${this.keypair.publicKey.toBase58()}
Nonce: ${nonce}
Timestamp: ${Date.now()}`;
    
    const messageBytes = new TextEncoder().encode(message);
    const signature = nacl.sign.detached(messageBytes, this.keypair.secretKey);
    
    const response = await axios.post(`${this.apiUrl}/authenticate`, {
      username,
      signature: bs58.encode(signature),
      nonce,
      create: true
    });
    
    return response.data.token;
  }
}

// Usage
const auth = new SolanaAuth(secretKeyBytes, 'https://api.example.com');
const token = await auth.authenticate('example.sol');
```

### API Token Management
```javascript
class WildDuckClient {
  constructor(apiUrl, token) {
    this.apiUrl = apiUrl;
    this.token = token;
    this.axios = axios.create({
      baseURL: apiUrl,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async createApiToken(userId, description, scopes = ['*']) {
    const response = await this.axios.post(`/users/${userId}/tokens`, {
      description,
      scopes,
      restrictions: {
        expire: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
      }
    });
    
    return response.data.token;
  }

  async revokeToken(userId, tokenId) {
    await this.axios.delete(`/users/${userId}/tokens/${tokenId}`);
  }
}
```

## User Management Patterns

### User Lifecycle Management
```javascript
class UserManager {
  constructor(client) {
    this.client = client;
  }

  async createUserWithDefaults(userData) {
    const defaultSettings = {
      quota: 1 * 1024 * 1024 * 1024, // 1GB
      retention: 0, // No retention limit
      enabled: true,
      language: 'en',
      encryptMessages: false,
      encryptForwarded: false,
      featureFlags: ['indexing']
    };

    const user = await this.client.axios.post('/users', {
      ...defaultSettings,
      ...userData
    });

    // Create default addresses
    await this.createDefaultAddresses(user.data.id, userData.username);
    
    // Setup default mailboxes
    await this.setupDefaultMailboxes(user.data.id);
    
    return user.data;
  }

  async createDefaultAddresses(userId, username) {
    // Main address
    await this.client.axios.post(`/users/${userId}/addresses`, {
      address: username,
      name: username.split('@')[0],
      main: true
    });

    // Common aliases
    const localPart = username.split('@')[0];
    const domain = username.split('@')[1];
    
    const aliases = [
      `${localPart}+noreply@${domain}`,
      `${localPart}+support@${domain}`
    ];

    for (const alias of aliases) {
      await this.client.axios.post(`/users/${userId}/addresses`, {
        address: alias,
        name: localPart,
        main: false
      });
    }
  }

  async setupDefaultMailboxes(userId) {
    const defaultMailboxes = [
      { path: 'Sent', retention: 0 },
      { path: 'Drafts', retention: 0 },
      { path: 'Trash', retention: 30 },
      { path: 'Junk', retention: 7 },
      { path: 'Archive', retention: 0 }
    ];

    for (const mailbox of defaultMailboxes) {
      await this.client.axios.post(`/users/${userId}/mailboxes`, mailbox);
    }
  }
}
```

### Bulk User Operations
```javascript
class BulkUserOperations {
  constructor(client) {
    this.client = client;
  }

  async importUsers(users, options = {}) {
    const results = {
      success: [],
      failed: [],
      total: users.length
    };

    const batchSize = options.batchSize || 10;
    
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      const promises = batch.map(async (userData) => {
        try {
          const user = await this.createUser(userData);
          results.success.push({ user: userData, result: user });
        } catch (error) {
          results.failed.push({ user: userData, error: error.message });
        }
      });

      await Promise.all(promises);
      
      // Rate limiting
      if (i + batchSize < users.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  async updateQuotas(userQuotaMap) {
    const updates = Object.entries(userQuotaMap).map(async ([userId, quota]) => {
      try {
        await this.client.axios.put(`/users/${userId}`, { quota });
        return { userId, success: true };
      } catch (error) {
        return { userId, success: false, error: error.message };
      }
    });

    return Promise.all(updates);
  }
}
```

## Message Handling Patterns

### Email Composition and Sending
```javascript
class EmailComposer {
  constructor(client) {
    this.client = client;
  }

  async sendSimpleEmail(userId, to, subject, content) {
    const message = {
      from: {
        name: await this.getUserName(userId),
        address: await this.getUserMainAddress(userId)
      },
      to: Array.isArray(to) ? to : [{ address: to }],
      subject,
      text: typeof content === 'string' ? content : content.text,
      html: content.html || undefined
    };

    return this.client.axios.post(`/users/${userId}/submit`, message);
  }

  async sendTemplatedEmail(userId, templateId, recipients, variables) {
    const template = await this.getTemplate(templateId);
    
    const promises = recipients.map(async (recipient) => {
      const personalizedContent = this.interpolateTemplate(template, {
        ...variables,
        recipient
      });

      return this.sendSimpleEmail(userId, recipient.address, 
        personalizedContent.subject, personalizedContent);
    });

    return Promise.all(promises);
  }

  async sendWithAttachments(userId, messageData, attachments) {
    // Upload attachments first
    const uploadedAttachments = [];
    
    for (const attachment of attachments) {
      const uploadResponse = await this.uploadAttachment(userId, attachment);
      uploadedAttachments.push({
        id: uploadResponse.data.id,
        filename: attachment.filename,
        contentType: attachment.contentType
      });
    }

    // Send message with attachment references
    return this.client.axios.post(`/users/${userId}/submit`, {
      ...messageData,
      attachments: uploadedAttachments
    });
  }

  async uploadAttachment(userId, attachment) {
    const formData = new FormData();
    formData.append('attachment', attachment.data, attachment.filename);
    
    return this.client.axios.post(`/users/${userId}/attachment`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  }
}
```

### Message Processing and Filtering
```javascript
class MessageProcessor {
  constructor(client) {
    this.client = client;
  }

  async createSpamFilter(userId) {
    const spamFilter = {
      name: 'Spam Detection',
      query: {
        or: [
          { subject: '*[SPAM]*' },
          { subject: '*viagra*' },
          { from: '*@spam-domain.com' },
          { headers: { 'X-Spam-Flag': 'YES' } }
        ]
      },
      action: {
        mailbox: await this.getJunkMailboxId(userId),
        seen: true,
        flag: true
      }
    };

    return this.client.axios.post(`/users/${userId}/filters`, spamFilter);
  }

  async createVIPFilter(userId, vipAddresses) {
    const vipFilter = {
      name: 'VIP Messages',
      query: {
        from: vipAddresses.map(addr => `*${addr}*`)
      },
      action: {
        mailbox: await this.getInboxId(userId),
        seen: false,
        flag: true,
        forward: 'mobile@example.com' // Forward to mobile
      }
    };

    return this.client.axios.post(`/users/${userId}/filters`, vipFilter);
  }

  async processIncomingMessage(userId, rawMessage) {
    // Parse message headers
    const headers = this.parseHeaders(rawMessage);
    
    // Apply custom logic
    if (this.isAutoReply(headers)) {
      // Handle auto-replies differently
      return this.handleAutoReply(userId, rawMessage);
    }
    
    // Store message
    const result = await this.client.axios.post(
      `/users/${userId}/mailboxes/${await this.getInboxId(userId)}/messages`,
      {
        raw: rawMessage.toString('base64'),
        flags: this.determineInitialFlags(headers)
      }
    );

    // Trigger post-processing
    await this.postProcessMessage(userId, result.data.id, headers);
    
    return result;
  }
}
```

## Mailbox Management Patterns

### Advanced Mailbox Operations
```javascript
class MailboxManager {
  constructor(client) {
    this.client = client;
  }

  async organizeMailboxes(userId, organizationScheme = 'year-month') {
    const messages = await this.getAllMessages(userId);
    
    switch (organizationScheme) {
      case 'year-month':
        await this.organizeByYearMonth(userId, messages);
        break;
      case 'sender':
        await this.organizeBySender(userId, messages);
        break;
      case 'size':
        await this.organizeBySize(userId, messages);
        break;
    }
  }

  async organizeByYearMonth(userId, messages) {
    const dateGroups = new Map();
    
    messages.forEach(message => {
      const date = new Date(message.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!dateGroups.has(key)) {
        dateGroups.set(key, []);
      }
      dateGroups.get(key).push(message);
    });

    for (const [dateKey, groupMessages] of dateGroups) {
      const mailboxPath = `Archive/${dateKey}`;
      
      // Create mailbox if it doesn't exist
      await this.createMailboxIfNotExists(userId, mailboxPath);
      
      // Move messages
      await this.moveMessages(userId, groupMessages, mailboxPath);
    }
  }

  async createMailboxIfNotExists(userId, path) {
    try {
      await this.client.axios.post(`/users/${userId}/mailboxes`, { path });
    } catch (error) {
      if (error.response?.status !== 409) { // 409 = already exists
        throw error;
      }
    }
  }

  async moveMessages(userId, messages, targetMailboxPath) {
    const targetMailbox = await this.getMailboxByPath(userId, targetMailboxPath);
    
    const batchSize = 100;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      
      const movePromises = batch.map(message => 
        this.client.axios.put(
          `/users/${userId}/mailboxes/${message.mailbox}/messages/${message.id}/move`,
          { mailbox: targetMailbox.id }
        )
      );
      
      await Promise.all(movePromises);
    }
  }
}
```

### Quota and Storage Management
```javascript
class StorageManager {
  constructor(client) {
    this.client = client;
  }

  async analyzeUserStorage(userId) {
    const storage = await this.client.axios.get(`/users/${userId}/storage`);
    const mailboxes = storage.data.mailboxes;
    
    const analysis = {
      totalUsed: storage.data.storageUsed,
      quota: storage.data.quota,
      utilizationPercentage: storage.data.storagePercentage,
      largestMailboxes: mailboxes
        .sort((a, b) => b.storageUsed - a.storageUsed)
        .slice(0, 5),
      recommendations: []
    };

    // Generate recommendations
    if (analysis.utilizationPercentage > 90) {
      analysis.recommendations.push('URGENT: Storage almost full');
    }
    
    if (analysis.utilizationPercentage > 80) {
      analysis.recommendations.push('Consider cleaning old messages');
      analysis.recommendations.push('Empty trash and junk folders');
    }

    const trashMailbox = mailboxes.find(m => m.path === 'Trash');
    if (trashMailbox && trashMailbox.storageUsed > analysis.totalUsed * 0.1) {
      analysis.recommendations.push('Trash folder uses significant space');
    }

    return analysis;
  }

  async cleanupOldMessages(userId, options = {}) {
    const defaults = {
      trashRetentionDays: 30,
      junkRetentionDays: 7,
      sentRetentionDays: 365,
      archiveRetentionDays: 0 // No limit
    };
    
    const settings = { ...defaults, ...options };
    const results = {};

    // Clean trash
    results.trash = await this.cleanMailboxByAge(
      userId, 'Trash', settings.trashRetentionDays
    );

    // Clean junk
    results.junk = await this.cleanMailboxByAge(
      userId, 'Junk', settings.junkRetentionDays
    );

    // Clean sent (if specified)
    if (settings.sentRetentionDays > 0) {
      results.sent = await this.cleanMailboxByAge(
        userId, 'Sent', settings.sentRetentionDays
      );
    }

    return results;
  }

  async cleanMailboxByAge(userId, mailboxPath, retentionDays) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const mailbox = await this.getMailboxByPath(userId, mailboxPath);
    const messages = await this.client.axios.get(
      `/users/${userId}/mailboxes/${mailbox.id}/messages`,
      {
        params: {
          dateend: cutoffDate.toISOString(),
          limit: 1000
        }
      }
    );

    let deletedCount = 0;
    let freedBytes = 0;

    for (const message of messages.data.results) {
      await this.client.axios.delete(
        `/users/${userId}/mailboxes/${mailbox.id}/messages/${message.id}`
      );
      deletedCount++;
      freedBytes += message.size;
    }

    return { deletedCount, freedBytes };
  }
}
```

## Search and Filtering Patterns

### Advanced Search Operations
```javascript
class SearchManager {
  constructor(client) {
    this.client = client;
  }

  async searchAcrossAllMailboxes(userId, query) {
    const mailboxes = await this.client.axios.get(`/users/${userId}/mailboxes`);
    const searchPromises = mailboxes.data.results.map(async (mailbox) => {
      try {
        const results = await this.client.axios.get(
          `/users/${userId}/mailboxes/${mailbox.id}/messages`,
          { params: this.buildSearchParams(query) }
        );
        
        return {
          mailbox: mailbox.path,
          messages: results.data.results
        };
      } catch (error) {
        return {
          mailbox: mailbox.path,
          messages: [],
          error: error.message
        };
      }
    });

    const results = await Promise.all(searchPromises);
    
    return {
      query,
      totalResults: results.reduce((sum, r) => sum + r.messages.length, 0),
      byMailbox: results.filter(r => r.messages.length > 0)
    };
  }

  buildSearchParams(query) {
    const params = {};
    
    if (query.from) params.from = query.from;
    if (query.to) params.to = query.to;
    if (query.subject) params.subject = query.subject;
    if (query.dateStart) params.datestart = query.dateStart;
    if (query.dateEnd) params.dateend = query.dateEnd;
    if (query.hasAttachment !== undefined) params.attachments = query.hasAttachment;
    if (query.minSize) params.minSize = query.minSize;
    if (query.maxSize) params.maxSize = query.maxSize;
    if (query.flagged !== undefined) params.flagged = query.flagged;
    if (query.unseen !== undefined) params.unseen = query.unseen;
    
    return params;
  }

  async createSmartMailbox(userId, name, searchCriteria) {
    // Smart mailboxes are implemented as saved searches with filters
    const filter = {
      name: `Smart Mailbox: ${name}`,
      query: searchCriteria,
      action: {
        // Move matching messages to smart mailbox
        mailbox: await this.createSmartMailboxFolder(userId, name)
      }
    };

    return this.client.axios.post(`/users/${userId}/filters`, filter);
  }
}
```

## Error Handling and Retry Patterns

### Robust API Client
```javascript
class RobustWildDuckClient {
  constructor(apiUrl, token, options = {}) {
    this.apiUrl = apiUrl;
    this.token = token;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    
    this.axios = axios.create({
      baseURL: apiUrl,
      timeout: options.timeout || 30000,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  setupInterceptors() {
    // Request interceptor
    this.axios.interceptors.request.use(
      (config) => {
        config.metadata = { startTime: new Date() };
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.axios.interceptors.response.use(
      (response) => {
        const duration = new Date() - response.config.metadata.startTime;
        console.log(`API call to ${response.config.url} took ${duration}ms`);
        return response;
      },
      async (error) => {
        return this.handleError(error);
      }
    );
  }

  async handleError(error) {
    const config = error.config;
    
    // Don't retry if we've already retried too many times
    if (!config || config.__retryCount >= this.maxRetries) {
      return Promise.reject(error);
    }

    // Initialize retry count
    config.__retryCount = config.__retryCount || 0;
    config.__retryCount++;

    // Determine if we should retry
    if (this.shouldRetry(error)) {
      const delay = this.calculateRetryDelay(config.__retryCount);
      
      console.log(`Retrying API call (attempt ${config.__retryCount}) after ${delay}ms`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.axios(config);
    }

    return Promise.reject(error);
  }

  shouldRetry(error) {
    // Retry on network errors
    if (!error.response) return true;
    
    // Retry on server errors (5xx)
    if (error.response.status >= 500) return true;
    
    // Retry on rate limiting (429)
    if (error.response.status === 429) return true;
    
    // Don't retry on client errors (4xx except 429)
    return false;
  }

  calculateRetryDelay(attempt) {
    // Exponential backoff with jitter
    const baseDelay = this.retryDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * baseDelay;
    return Math.min(baseDelay + jitter, 30000); // Max 30 seconds
  }
}
```

This comprehensive guide provides practical patterns for integrating with WildDuck's API, handling common scenarios robustly, and implementing best practices for production use.