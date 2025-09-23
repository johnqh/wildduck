#!/bin/bash

DBNAME="$1"

# Get test configuration values from Node.js test config
get_test_config() {
    node -e "const config = require('../../test/test-config'); console.log(JSON.stringify({username: config.TEST_USERS.testuser, password: config.TEST_PASSWORDS.pass, sender: config.getTestEmail(config.TEST_USERS.sender), receiver: config.getTestEmail(config.TEST_USERS.receiver)}));"
}

TEST_CONFIG=$(get_test_config)
TEST_USERNAME=$(echo "$TEST_CONFIG" | jq -r '.username')
TEST_PASSWORD=$(echo "$TEST_CONFIG" | jq -r '.password')
SENDER_EMAIL=$(echo "$TEST_CONFIG" | jq -r '.sender')
RECEIVER_EMAIL=$(echo "$TEST_CONFIG" | jq -r '.receiver')

# Function to check if a string is a valid ObjectId
is_valid_objectid() {
    [[ "$1" =~ ^[0-9a-fA-F]{24}$ ]]
}

# Function to extract value from JSON response
extract_json_value() {
    echo "$1" | jq -r "$2" 2>/dev/null || echo "null"
}

echo "which mongo"
which mongo

# Wait for server to be fully ready
echo "Waiting for server to be ready..."
for i in {1..30}; do
    if curl -s "http://127.0.0.1:8080/users" > /dev/null 2>&1; then
        echo "Server is ready!"
        break
    fi
    echo "Waiting for server... ($i/30)"
    sleep 1
done

echo "Clearing DB - looking for existing $TEST_USERNAME"
# Find and delete existing test user
EXISTING_USER=$(curl --silent "http://127.0.0.1:8080/users?query=$TEST_USERNAME")
EXISTING_USER_ID=$(extract_json_value "$EXISTING_USER" '.results[0].id')

if [ "$EXISTING_USER_ID" != "null" ] && is_valid_objectid "$EXISTING_USER_ID"; then
    echo "Deleting existing user: $EXISTING_USER_ID"
    curl --silent -X DELETE "http://127.0.0.1:8080/users/$EXISTING_USER_ID" > /dev/null
    # Wait a moment for deletion to complete
    sleep 2
fi

echo "Creating user"
USERRESPONSE=$(curl --silent -XPOST http://127.0.0.1:8080/users \
-H 'Content-type: application/json' \
-d "{
  \"username\": \"$TEST_USERNAME\",
  \"password\": \"$TEST_PASSWORD\",
  \"name\": \"Test User\"
}")

echo "UR: $USERRESPONSE"
USERID=$(extract_json_value "$USERRESPONSE" '.id')

# Validate USERID
if [ "$USERID" = "null" ] || ! is_valid_objectid "$USERID"; then
    echo "Error: Failed to create user or invalid user ID: $USERID"
    echo "Response: $USERRESPONSE"
    exit 1
fi

echo "Reading Mailbox ID"
MAILBOXLIST=$(curl --silent "http://127.0.0.1:8080/users/$USERID/mailboxes")
echo "ML: $MAILBOXLIST"
echo "$MAILBOXLIST" | jq

INBOXID=$(extract_json_value "$MAILBOXLIST" '.results[0].id')
SENTID=$(extract_json_value "$MAILBOXLIST" '.results[3].id')

# Validate mailbox IDs
if [ "$INBOXID" = "null" ] || ! is_valid_objectid "$INBOXID"; then
    echo "Error: Invalid INBOX ID: $INBOXID"
    echo "Mailbox list: $MAILBOXLIST"
    exit 1
fi

if [ "$SENTID" = "null" ] || ! is_valid_objectid "$SENTID"; then
    echo "Error: Invalid SENT ID: $SENTID"
    echo "Mailbox list: $MAILBOXLIST"
    exit 1
fi

curl --silent -XPUT "http://127.0.0.1:8080/users/$USERID/mailboxes/$SENTID" \
-H 'Content-type: application/json' \
-d '{
  "path": "[Gmail]/Sent Mail"
}'

MAILBOXLIST=$(curl --silent "http://127.0.0.1:8080/users/$USERID/mailboxes")
echo "$MAILBOXLIST" | jq

# Generate dynamic EML files from templates
echo "Generating EML files from templates..."
if [ -f "../../test/utils/eml-generator.js" ]; then
    node ../../test/utils/eml-generator.js generate
    EML_GENERATION_SUCCESS=$?
else
    echo "Warning: EML generator not found, using static fixtures"
    EML_GENERATION_SUCCESS=1
fi

# Check if fixtures directory exists
if [ ! -d "fixtures" ]; then
    echo "Warning: fixtures directory not found, creating test messages without fixtures"
    FIXTURE_MODE="none"
else
    FIXTURE_MODE="files"
fi

# Add messages
if [ "$FIXTURE_MODE" = "files" ]; then
    # Use generated files if available, fallback to original fixtures
    if [ "$EML_GENERATION_SUCCESS" = "0" ] && [ -f "fixtures/generated/fix1.eml" ]; then
        FIX1_FILE="fixtures/generated/fix1.eml"
        echo "Using generated fix1.eml"
    else
        FIX1_FILE="fixtures/fix1.eml"
        echo "Using original fix1.eml"
    fi

    if [ "$EML_GENERATION_SUCCESS" = "0" ] && [ -f "fixtures/generated/fix3.eml" ]; then
        FIX3_FILE="fixtures/generated/fix3.eml"
        echo "Using generated fix3.eml"
    else
        FIX3_FILE="fixtures/fix3.eml"
        echo "Using original fix3.eml"
    fi

    if [ "$EML_GENERATION_SUCCESS" = "0" ] && [ -f "fixtures/generated/fix4.eml" ]; then
        FIX4_FILE="fixtures/generated/fix4.eml"
        echo "Using generated fix4.eml"
    else
        FIX4_FILE="fixtures/fix4.eml"
        echo "Using original fix4.eml"
    fi

    curl --silent -XPOST "http://127.0.0.1:8080/users/$USERID/mailboxes/$INBOXID/messages?date=14-Sep-2013%2021%3A22%3A28%20-0300&unseen=true" \
        -H 'Content-type: message/rfc822' \
        --data-binary "@$FIX1_FILE"

    curl --silent -XPOST "http://127.0.0.1:8080/users/$USERID/mailboxes/$INBOXID/messages?unseen=false" \
        -H 'Content-type: message/rfc822' \
        --data-binary "@fixtures/fix2.eml"

    curl --silent -XPOST "http://127.0.0.1:8080/users/$USERID/mailboxes/$INBOXID/messages?unseen=false" \
        -H 'Content-type: message/rfc822' \
        --data-binary "@$FIX3_FILE"

    curl --silent -XPOST "http://127.0.0.1:8080/users/$USERID/mailboxes/$INBOXID/messages?unseen=true" \
        -H 'Content-type: message/rfc822' \
        --data-binary "@$FIX4_FILE"
fi

curl --silent -XPOST "http://127.0.0.1:8080/users/$USERID/mailboxes/$INBOXID/messages?unseen=true" \
    -H 'Content-type: message/rfc822' \
    --data-binary "from: $SENDER_EMAIL
to: $RECEIVER_EMAIL
subject: test5

hello 5
"

curl --silent -XPOST "http://127.0.0.1:8080/users/$USERID/mailboxes/$INBOXID/messages?unseen=true" \
    -H 'Content-type: message/rfc822' \
    --data-binary "from: $SENDER_EMAIL
to: $RECEIVER_EMAIL
subject: test6

hello 6
"

# Use Node.js script for MongoDB operations to avoid mongosh compatibility issues
echo "Updating database with test data..."
node -e "
const { MongoClient, ObjectId } = require('mongodb');
const uri = 'mongodb://127.0.0.1:27017';
const dbName = '$DBNAME';
const inboxId = '$INBOXID';

if (!inboxId || inboxId === 'null' || !/^[0-9a-fA-F]{24}$/.test(inboxId)) {
    console.error('Invalid INBOX ID:', inboxId);
    process.exit(1);
}

async function updateDatabase() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);

    // Update mailbox
    const mailboxResult = await db.collection('mailboxes').updateOne(
      { _id: new ObjectId(inboxId) },
      { \$set: { modifyIndex: 5000, uidNext: 1000 } }
    );
    console.log('Mailbox update result:', mailboxResult.modifiedCount);

    // Update messages
    const msg1Result = await db.collection('messages').updateOne(
      { mailbox: new ObjectId(inboxId), uid: 1 },
      { \$set: { modseq: 100 } }
    );
    console.log('Message 1 update result:', msg1Result.modifiedCount);

    const msg2Result = await db.collection('messages').updateOne(
      { mailbox: new ObjectId(inboxId), uid: 2 },
      { \$set: { modseq: 5000 } }
    );
    console.log('Message 2 update result:', msg2Result.modifiedCount);

    const msgBulkResult = await db.collection('messages').updateMany(
      { mailbox: new ObjectId(inboxId) },
      { \$inc: { uid: 100 } }
    );
    console.log('Bulk message update result:', msgBulkResult.modifiedCount);

    console.log('Database updates completed successfully');
  } catch (error) {
    console.error('Database update error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

updateDatabase();
"

echo "Test data setup completed successfully"