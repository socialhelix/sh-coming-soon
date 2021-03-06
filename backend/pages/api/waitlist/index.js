import NextCors from 'nextjs-cors';
import axios from 'axios';

export default async function handler(req, res) {
    await NextCors(req, res, {
        // Options
        methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
        origin: '*',
        optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
    });

    if (req.method !== 'POST') {
        return res.status(405).send({ message: `Invalid method: ${req.method}. Only POST requests allowed.`});
    }

    const email = req.body.email;
    const referral = req.body.referral;
    const hasReferral = referral == undefined || referral.length == 0;

    if (!email) {
        return res.status(400).json({message: `Invalid email`});
    }

    const oauthReqBody = {
        "grant_type": "client_credentials",
        "client_id": process.env.API_USER_ID,
        "client_secret": process.env.API_SECRET
    }

    const oauthResponse = await axios.post("https://api.sendpulse.com/oauth/access_token", oauthReqBody);
    const token = oauthResponse.data.access_token;

    const emails = [
        {
            email: email,
            variables: {
                referredBy: referral,
                time: new Date(Date.now()).toLocaleString()
            }
        }
    ];

    const config = {
        headers: {
            "Authorization": "Bearer " + token
        }
    }
    
    const doubleOptReqBody = {
        "emails": emails,
    }
    
    // Add new email to list
    const data = (await axios.post(`https://api.sendpulse.com/addressbooks/${process.env.MAILING_LIST_ID}/emails`, doubleOptReqBody, config)).data;
    
    if(data !== undefined) {
        if (data.result === true) {
            if(hasReferral) {
                const referralData = await axios.post(`https://api.sendpulse.com/addressbooks/${process.env.MAILING_LIST_ID}/emails/${referral}`);
                console.log(referralData);
                if(referralData !== undefined) {
                    // Update referralCount in the address book
                    const incrementResult = axios.post(`https://api.sendpulse.com/addressbooks/${process.env.MAILING_LIST_ID}/emails/variable`, referral, {
                        // Increment referralCount by 1
                        referralCount: referralData.variables.referralCount + 1
                    }); 
                    if(incrementResult !== undefined) {
                        if (incrementResult.result === true) {
                            return res.status(200).json({message: 'Success'});
                        }
                    }
                } 
            }
            return res.status(200).json({message: 'Success'});
        } else if (data.result === false) {
            return res.status(400).json({message: 'Email is already registered'});
        }
    }
    
    return res.status(500).json({message: 'Internal server error'});
}   