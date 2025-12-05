#!/bin/bash

# Farger for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Pusher kode til git...${NC}\n"

# Sjekk om det er endringer
if [ -z "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  Ingen endringer å committe.${NC}"
    exit 0
fi

# Vis status
echo -e "${YELLOW}📋 Status:${NC}"
git status -s
echo ""

# Legg til alle endringer
echo -e "${YELLOW}➕ Legger til endringer...${NC}"
git add .

# Commit melding
if [ -z "$1" ]; then
    COMMIT_MSG="Oppdatert kode"
else
    COMMIT_MSG="$1"
fi

# Commit
echo -e "${YELLOW}💾 Committer med melding: '${COMMIT_MSG}'${NC}"
git commit -m "$COMMIT_MSG"

# Push
echo -e "${YELLOW}📤 Pusher til remote...${NC}"
if git push; then
    echo -e "\n${GREEN}✅ Suksess! Koden er pushet til git.${NC}"
else
    echo -e "\n${RED}❌ Feil ved push. Sjekk feilmeldingen over.${NC}"
    exit 1
fi

