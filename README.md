**_ SCRAPPER MAYO CLINIC AND DRUGS _**

**Mayo Clinic**

1. Run `mc-letters-scrapper.js`, this retrieve the hrefs of each disease.
2. Run `mc-url-converter.js`, that gets the diagnosis & treatment href from the disease.
3. Run `mc-scrapper.js`, which gets the wanted data.
4. `mc-analyze-data.js` (optional), gets stats from the data, and also save it into a .xlsx.

**Drugs.com**

1. Run `drugs-letters-scrapper.js`, this retrieve the hrefs of each drug.
2. Run `drugs-scrapper.js`, which gets the wanted data.
3. `drugs-analyse-data.js` (optional), gets stats from the data, and also save it into a .xlsx.

4. Run `drugs-diseases-scrapper.js` and `drugs-diseases-analyze.js` for retrieving
   diseases associated with its drugs.

Note: the `analyze-data` of each one get its data saved on the directory `Analysis`

Note: Json for checkpoints are created, can be deleted.
