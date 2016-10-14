#include <openssl/pkcs7.h>
#include <openssl/evp.h>
#include <stdio.h>
#include <ctype.h>
#include "Payload.h"

struct string {
    char* buf;
    size_t len;
};

int htoi(const char c) {
    const char uc = toupper(c);
    if (uc >= '0' && uc <= '9')
        return uc - '0';
    else if (uc >= 'A' && uc <= 'F')
        return uc - 'A' + 10;
    else
        return -1;
}

void uuidBytes(const char* uuidString, uint8_t* uuidBytes) {
    int i;
    for (i = 0; i < 16;) {
        if (uuidString[0] == '-') {
            uuidString++;
            continue;
        }
        else {
            uint8_t byte = (htoi(uuidString[0]) << 4) + htoi(uuidString[1]);
            uuidBytes[i++] = byte;
            uuidString += 2;
        }
    }
}

static const unsigned char pr2six[256] =
{
    /* ASCII table */
    64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64,
    64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64,
    64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 62, 64, 64, 64, 63,
    52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 64, 64, 64, 64, 64, 64,
    64,  0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14,
    15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 64, 64, 64, 64, 64,
    64, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
    41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 64, 64, 64, 64, 64,
    64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64,
    64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64,
    64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64,
    64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64,
    64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64,
    64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64,
    64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64,
    64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64
};

int base64decode(char *bufplain, const char *bufcoded)
{
    int nbytesdecoded;
    register const unsigned char *bufin;
    register unsigned char *bufout;
    register int nprbytes;
    
    bufin = (const unsigned char *) bufcoded;
    while (pr2six[*(bufin++)] <= 63);
    nprbytes = (bufin - (const unsigned char *) bufcoded) - 1;
    nbytesdecoded = ((nprbytes + 3) / 4) * 3;
    
    bufout = (unsigned char *) bufplain;
    bufin = (const unsigned char *) bufcoded;
    
    while (nprbytes > 4) {
        *(bufout++) =
        (unsigned char) (pr2six[*bufin] << 2 | pr2six[bufin[1]] >> 4);
        *(bufout++) =
        (unsigned char) (pr2six[bufin[1]] << 4 | pr2six[bufin[2]] >> 2);
        *(bufout++) =
        (unsigned char) (pr2six[bufin[2]] << 6 | pr2six[bufin[3]]);
        bufin += 4;
        nprbytes -= 4;
    }
    
    /* Note: (nprbytes == 1) would be an error, so just ingore that case */
    if (nprbytes > 1) {
        *(bufout++) =
        (unsigned char) (pr2six[*bufin] << 2 | pr2six[bufin[1]] >> 4);
    }
    if (nprbytes > 2) {
        *(bufout++) =
        (unsigned char) (pr2six[bufin[1]] << 4 | pr2six[bufin[2]] >> 2);
    }
    if (nprbytes > 3) {
        *(bufout++) =
        (unsigned char) (pr2six[bufin[2]] << 6 | pr2six[bufin[3]]);
    }
    
    *(bufout++) = '\0';
    nbytesdecoded -= (4 - nprbytes) & 3;
    return nbytesdecoded;
}

int validate(BIO* receiptBIO, const char* uuid) {
    PKCS7 *receiptPKCS7 = d2i_PKCS7_bio(receiptBIO, NULL);
    
    if (!receiptPKCS7) {
        return 1;
    }
    
    void *pld = receiptPKCS7->d.sign->contents->d.data->data;
    size_t pld_sz = receiptPKCS7->d.sign->contents->d.data->length;
    
    Payload_t *payload = NULL;
    asn_dec_rval_t rval;
    
    rval = asn_DEF_Payload.ber_decoder(NULL, &asn_DEF_Payload, (void **)&payload, pld, pld_sz, 0);
    
    size_t i;
    
    OCTET_STRING_t *bundle_id = NULL;
    OCTET_STRING_t *bundle_version = NULL;
    OCTET_STRING_t *opaque = NULL;
    OCTET_STRING_t *hash = NULL;
    
    for (i = 0; i < payload->list.count; i++) {
        ReceiptAttribute_t *entry;
        
        entry = payload->list.array[i];
        
        switch (entry->type) {
            case 2:
                bundle_id = &entry->value;
                break;
            case 3:
                bundle_version = &entry->value;
                break;
            case 4:
                opaque = &entry->value;
                break;
            case 5:
                hash = &entry->value;
                break;
        }
    }
    
    const size_t deviceIDSize = 16;
    uint8_t deviceID[deviceIDSize];
    
    //uuid_bytes("438498A7-4850-41DB-BCBE-4E1756378E39", guid);
    uuidBytes(uuid, deviceID);
    
    /* Declare and initialize an EVP context for OpenSSL. */
    EVP_MD_CTX evp_ctx;
    EVP_MD_CTX_init(&evp_ctx);
    
    /* A buffer for result of the hash computation. */
    uint8_t digest[20];
    
    /* Set up the EVP context to compute a SHA-1 digest. */
    EVP_DigestInit_ex(&evp_ctx, EVP_sha1(), NULL);
    
    /* Concatenate the pieces to be hashed.  They must be concatenated in this order. */
    EVP_DigestUpdate(&evp_ctx, deviceID, deviceIDSize);
    EVP_DigestUpdate(&evp_ctx, opaque->buf, opaque->size);
    EVP_DigestUpdate(&evp_ctx, bundle_id->buf, bundle_id->size);
    
    /* Compute the hash, saving the result into the digest variable. */
    EVP_DigestFinal_ex(&evp_ctx, digest, NULL);
    
    return memcmp(digest, hash->buf, 20);
}

int main(int argc, const char * argv[]) {
    const char* receiptPath = NULL;
    const char* uuid = NULL;
    const char* jsonStr = NULL;
    int useJSONStreamInput = 0;
    
    int i = 0;
    for (i = 1; i < argc; i++) {
        if (strcmp(argv[i], "-i") == 0)
            receiptPath = argv[++i];
        else if (strcmp(argv[i], "--uuid") == 0)
            uuid = argv[++i];
        else if (strcmp(argv[i], "--json") == 0)
            useJSONStreamInput = 1;
        else if (strcmp(argv[i], "--json-string") == 0)
            jsonStr = argv[++i];
    }
    
    if (jsonStr && uuid) {
        const char* const receipt = jsonStr;
        char* decodedReceipt = malloc(strlen(receipt) + 1);
        size_t decodedReceiptLen = base64decode(decodedReceipt, receipt);
        if (decodedReceiptLen > 0) {
            BIO *receiptBIO = BIO_new(BIO_s_mem());
            BIO_write(receiptBIO, decodedReceipt, (int) decodedReceiptLen);
            const int b = validate(receiptBIO, uuid);
            BIO_free(receiptBIO);
            free(decodedReceipt);
            if (b == 0)
                printf("{\"status\":1, \"status_string\":\"Passed\"}\n");
            else
                printf("{\"status\":0, \"status_string\":\"Failed\"}\n");
            return 0;
        }
        else {
            free(decodedReceipt);
        }
        
        printf("{\"error\":\"Invalid input string\"}\n");
        return 1;
    }
    else if (useJSONStreamInput) {
        size_t size = 10240;
        size_t len = 0;
        char* in = malloc(size);
        
        
        
        while (!feof(stdin)) {
            char c = getchar();
            in[len++] = c;
            if (len >= size - 1) {
                size *= 2;
                in = realloc(in, size);
            }
        }
        
        struct string receipt = {0};
        struct string uuid = {0};
        struct string current = {0};
        struct string key = {0};
        
        int state = 0;
        
        int i;
        for (i = 0; i < len; i++) {
            char c = in[i];
            if (state == 0) {
                if (c == '"') {
                    state = 1;
                    current.buf = in + i + 1;
                    current.len = 0;
                }
                else if (c == ':') {
                    key = current;
                }
                else if (c == ',' || c == '}') {
                    if (key.len == 7 && memcmp(key.buf, "receipt", key.len) == 0) {
                        receipt = current;
                    }
                    else if (key.len == 4 && memcmp(key.buf, "uuid", key.len) == 0) {
                        uuid = current;
                    }
                }
            }
            else if (state == 1) {
                if (c == '"') {
                    current.len = in + i - current.buf;
                    state = 0;
                }
            }
            
        }
        
        if (receipt.buf && uuid.buf) {
            char* decodedReceipt = malloc(receipt.len);
            size_t decodedReceiptLen = base64decode(decodedReceipt, receipt.buf);
            if (decodedReceiptLen > 0) {
                uuid.buf[uuid.len] = 0;
                BIO *receiptBIO = BIO_new(BIO_s_mem());
                BIO_write(receiptBIO, decodedReceipt, (int) decodedReceiptLen);
                int b = validate(receiptBIO, uuid.buf);
                BIO_free(receiptBIO);
                free(in);
                free(decodedReceipt);
                if (b == 0)
                    printf("{\"status\":1, \"status_string\":\"Passed\"}\n");
                else
                    printf("{\"status\":0, \"status_string\":\"Failed\"}\n");
                return 0;
            }
            else {
                free(decodedReceipt);
            }
        }
        
        free(in);
        printf("{\"error\":\"Invalid input string\"}\n");
        return 1;
    }
    else if (receiptPath && uuid) {
        FILE* f = fopen(receiptPath, "rb");
        
        if (!f) {
            printf("Receipt not found\n");
            return 1;
        }
        
        int size = 0;
        char buf[1024];
        BIO *receiptBIO = BIO_new(BIO_s_mem());
        
        while (!feof(f)) {
            size = (int) fread(buf, 1, 1024, f);
            BIO_write(receiptBIO, buf, size);
        }
        fclose(f);
        
        int b = validate(receiptBIO, uuid);
        
        
        BIO_free(receiptBIO);
        if (b == 0)
            printf("Passed\n");
        else
            printf("Failed\n");
        return b;
    }
    else {
        printf("Usage:\ncheckreceipt [-i receipt_path --uuid uuid] [--json]\n--json\tstreamed input {\"receipt\":base64_encoded_receipt,\"uuid\":uuid_string_representation}\n");
    }
    return 1;
}
