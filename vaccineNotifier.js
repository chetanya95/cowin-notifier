require('dotenv').config()
const moment = require('moment');
const cron = require('node-cron');
const notifier = require('./notifier');
const findEntries = require('./find_entries.json');
const fetch = require('node-fetch');

console.log("Entries: " + JSON.stringify(findEntries));

async function main() {
    try {
        cron.schedule('*/5 * * * *', async () => { // every 5 mins
            await checkAvailability();
        });
    } catch (e) {
        console.log('an error occured: ' + JSON.stringify(e, null, 2));
        throw e;
    }
}

async function checkAvailability() {
    let datesArray = fetchNext10Days();

    for(entry of findEntries){
        var findBy = entry.find_by;
        var findValue = entry.find_value;
        var age = entry.age;
        var toEmail = entry.to_email;
        console.log("Finding available slots for " + toEmail + " of age " + age + " by " + findBy + " " + findValue);

        for(date of datesArray){
            const isSlotFound = await getSlotsForDate(date, findBy, findValue, age, toEmail);
            if(isSlotFound === true){
                break;
            }
        }
    };
}

async function getSlotsForDate(date, findBy, findValue, age, toEmail) {
    const URL_FIND_BY_PINCODE = 'https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByPin?pincode=' + findValue + '&date=' + date;
    const URL_FIND_BY_DISTRICT = 'https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByDistrict?district_id=' + findValue + '&date=' + date;
    var url = findBy === 'district' ? URL_FIND_BY_DISTRICT : URL_FIND_BY_PINCODE;

    headers = {
        'Accept': '*/*',
        'Cache-Control': 'no-cache',
        'Host': 'cdn-api.co-vin.in',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36'
    };

    let isSlotFound = false;
    try{
        const response = await fetch(url, { method: 'GET', headers: headers });
        const responseJSON = await response.json();
        const centers = responseJSON.centers;
        for(let center of centers){
            let sessions = center.sessions;
            //console.log('center:' + JSON.stringify(center));
            //console.log('sessions:' + JSON.stringify(sessions));
            if(sessions){
                let validSlots = sessions.filter(session => session.min_age_limit <= age && session.available_capacity > 0);
                console.log({ date: date, center: center.name, validSlots: validSlots.length });
                if (validSlots.length > 0) {
                    console.log("Valid vaccination slot(s) found for user " + toEmail + ", in center " +  center.name + ", sending an email");
                    notifyMe(center, toEmail);
                    isSlotFound = true;
                    break;
                }
            }
        }
    } catch (error){
        console.error(error);
    }
    return isSlotFound;
}

async function notifyMe(center, toEmail) {
    const details = JSON.stringify(center, null, '\t');
    notifier.sendEmail(toEmail, 'Vaccine available on COWIN Portal!', details, (err, result) => {
        if (err) {
            console.error({ err });
        }
    })
};

function fetchNext10Days() {
    let dates = [];
    let today = moment();
    for (let i = 0; i < 10; i++) {
        let dateString = today.format('DD-MM-YYYY')
        dates.push(dateString);
        today.add(1, 'day');
    }
    return dates;
}


main()
    .then(() => { console.log('Vaccine availability checker started.'); });
