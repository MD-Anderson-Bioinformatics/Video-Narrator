#!/usr/local/bin/node

"use strict";

// Import the Google Cloud client library and other
// standard libraries.
const textToSpeech = require('@google-cloud/text-to-speech');
const { spawnSync } = require('child_process');
const fs = require('fs');
const util = require('util');
const writeFile = util.promisify(fs.writeFile);

const fragCache = 'fragment-cache/';
const audioFormat = 'OGG_OPUS';
const audioExt = '.ogg';
const debug = false;

// Create a text-to-speechclient.
const client = new textToSpeech.TextToSpeechClient();

// User can modify these via command line options.
var audioOptions = {};
var voiceOptions = {};
var overwrite = false;


// Read JSON-formatted content from the specified file.
async function getJSON (filename) {
        const content = fs.readFileSync(filename);
	return JSON.parse (content);
}

// Convert a speech fragment into speech, if necessary.
//
// The parameter is the file in the fragment cache
// containing the speech (ssml) text for the fragment.
// On completion, the audio file for the fragment is
// in the fragment cache.
//
// Before converting, the function compares the input file
// to its check file.  If identical, the corresponding
// audio file is assumed to be up to date.
// Otherwise, the function uses the text-to-speech API
// to convert the fragment into audio and copies the
// source file to the check file so that subsequent calls
// don't needlessly reconvert the input.
//
async function convertAudio (fragSourceFile) {
    let sourceType, outputFile, checkFile;
    if (debug) console.log ('Fragment source file: ' + fragSourceFile);
    if (fragSourceFile.match(/.ssml$/)) {
	sourceType = 'ssml';
	outputFile = fragSourceFile.replace(/.ssml$/, audioExt);
	checkFile = fragSourceFile.replace(/.ssml$/, '.check');
    } else if (fragSourceFile.match(/.text$/)) {
	sourceType = 'text';
	outputFile = fragSourceFile.replace(/.text$/, audioExt);
	checkFile = fragSourceFile.replace(/.text$/, '.check');
    } else {
        throw new Error ('fragSourceFile must end with .text or .ssml');
    }
    if (debug) console.log('convertAudio: Process as ' + sourceType + ' output to ' + outputFile);
    let res = spawnSync ('/usr/bin/cmp', [ '-s', fragSourceFile, checkFile ]);
    if (res.status === 0) {
	if (debug) console.log ('Arg up to date, skipping: ' + fragSourceFile);
	return;
    }
    let content;
    try {
        content = fs.readFileSync(fragSourceFile);
    } catch(err) {
	console.log ('Error processing input ' + fragSourceFile + ':');
	console.error (err);
	return;
    };
    if (debug) {
        console.log ('Content:');
        console.log (content);
    }


    // Construct the request
    const request = {
        input: {},
        // Select the language and SSML Voice Gender (optional)
	// voiceOptions override all defaults.
        voice: Object.assign ({}, { languageCode: 'en-US', ssmlGender: 'NEUTRAL' }, voiceOptions),
        // Select the type of audio encoding
	// audioOptions do not override audio format.
        audioConfig: Object.assign ({}, audioOptions, { audioEncoding: audioFormat }),
    };
    request.input[sourceType] = content;

    // Performs the Text-to-Speech request
    const [response] = await client.synthesizeSpeech(request);
    // Write the binary audio content to a local file
    await writeFile(outputFile, response.audioContent, 'binary');
    if (debug) console.log('Audio content written to file: ' + outputFile);
    await writeFile(checkFile, content, 'utf8');
    if (debug) console.log('Source content written to file: ' + checkFile);
}


// Parse the narration script and return an array of narration fragments.
//
// Narration script consists of one or more fragments.  Each fragment
// consists of:
//     startTime fragmentName
//     <speak>
//       ssml content
//     </speak>
//     blank line
//
// Start time has the format [[hours:]minutes:]seconds[.partialseconds]
//
async function parseScript (scriptFile) {
	const input = fs.readFileSync(scriptFile, 'utf-8').split(/\r?\n/);
	const fragments = [];

	let bad = false;
	for (let idx=0; idx < input.length; idx++) {
	    if (input[idx] === '') continue;
	    let ff = input[idx].split(' ');
	    if (ff.length !== 2) {
		console.log('Misformed fragment spec on line ' + (idx+1) + ': ' + input[idx]);
		bad = true;
		break;
	    }
	    let time = ff[0].split (':');
	    time=time.reduce((tt, t) => tt*60 + +t, 0);
	    if (debug) console.log ('Fragment ' + ff[1] + ' at ' + time + ' seconds.');
	    let fragment = {
	        startTime: time,
	        fragmentName: ff[1],
	        content: []
	    };
	    while (input[idx+1] !== '') {
		idx++;
		fragment.content.push(input[idx]);
	    }
	    if (fragment.content[0] === '<speak>' && fragment.content[fragment.content.length-1] === '</speak>') {
		fragment.format = 'ssml';
		if (debug) console.log('fragment format is ssml');
		fragments.push (fragment);
	    } else {
		console.log('fragment format does not seem to be ssml:');
		console.log('Fragment[0]: ' + fragment[0]);
		console.log('Fragment[-1]: ' + fragment[fragment.length-1]);
		bad = true;
	    }
	}
	if (bad) {
	    console.log ('Errors detected in input script.  No audio conversion performed.');
	    return null;
	} else {
	    return fragments;
	}
}

// Determine the duration in seconds of the audio file contained in filename.
//
async function duration (filename) {
    let res = spawnSync ('ffprobe', [ 
	'-v', 'error',
	'-show_entries', 'format=duration',
	'-of', 'default=noprint_wrappers=1:nokey=1',
	filename]);
    if (debug) {
        console.log ('Duration of ' + filename + ':');
        console.log (res);
    }
    if (res.status !== 0) return -1;
    const time = res.stdout.toString();
    if (debug) {
        console.log ('Duration is ' + time + ' (' + +time + ')');
    }
    return +time;
}

// Combine the audio fragments in fragments (each of which has a
// valid audiofile) into a single audio file, with additional
// silence added as needed.
//
async function combineAudio (fragments, outfile) {
    const args = [];
    const filters = [];
    const inputs = [];
    let currentTime = 0;
    let idx = 0;
    // For each fragment, add the silence before the fragment and the audio fragment to the list
    // of inputs.
    fragments.forEach(fragment => {
	// Add audio file for fragment as an input
	args.push('-i');
	args.push(fragCache + fragment.fragmentName + audioExt);
	// Add silence before audio file as a stream.
	filters.push(`aevalsrc=0:d=${fragment.startTime-currentTime} [s${idx}]`);
	// Advance time to end of audio fragment.
	currentTime = fragment.startTime + fragment.duration;
	// Add silence followed by audio fragment to inputs.
	inputs.push(`[s${idx}]`);
	inputs.push(`[${idx}]`);
	idx++;
    });
    // Add filter to concatenate inputs.
    filters.push (`${inputs.join('')} concat=n=${inputs.length}:v=0:a=1 [au]`);
    args.push ('-filter_complex');
    args.push (filters.join(';'));
    // Map output stream to output file.
    args.push ('-map');
    args.push ('[au]');
    if (overwrite) args.push ('-y');
    args.push (outfile);
    if (debug) console.log ({ args });

    let res = spawnSync ('ffmpeg', args);
    if (res.status !== 0) {
	console.log ('failed to combine audio fragments:');
	console.log (res.stderr.toString());
    }
    return res.status === 0;
}

function processOption (args) {
    if (args[0].match(/^-audio$/) && args.length > 1) {
	audioOptions = getJSON (args[1]);
	return 1;
    }
    if (args[0].match(/^-voice$/) && args.length > 1) {
	voiceOptions = getJSON (args[1]);
	return 1;
    }
    if (args[0].match(/^-y$/)) {
        overwrite = true;
	return 0;
    }
    console.log ('Unknown option ' + args[0]);
    return 0;
}

async function main() {

  if (debug) console.log('Process has ' + process.argv.length + ' command line arguments');

  // Create fragment cache if it doesn't already exist.
  if (!fs.existsSync(fragCache)) {
    fs.mkdirSync (fragCache);
  }
  // Process options and script files.
  for (let idx = 2; idx < process.argv.length; idx++) {
    const arg = process.argv[idx];
    if (arg.match (/^-./)) {
        idx += processOption (process.argv.slice (idx));
	continue;
    }
    const fragments = await parseScript (arg);
    if (fragments) {
	for (let chidx = 0; chidx < fragments.length; chidx++) {
	    const fragment = fragments[chidx];
	    //console.log (fragment);
	    const fragmentFile = fragCache + fragment.fragmentName + '.ssml';
	    await writeFile(fragmentFile, fragment.content.join('\n')+'\n', 'utf8');
	    if (debug) console.log('Source content written to file: ' + fragmentFile);
	    await convertAudio (fragmentFile);
	}
	let bad = false;
	for (let chidx = 0; chidx < fragments.length; chidx++) {
	    const fragment = fragments[chidx];
	    const audioFile = fragCache + fragment.fragmentName + audioExt;
	    fragment.duration = await duration (audioFile);
	    if (fragment.duration < 0) {
		console.log ('Unable to get duration for ' + audioFile);
		bad = true;
	    }
	}
	if (!bad) {
		let currentTime = 0;
		for (let chidx = 0; chidx < fragments.length; chidx++) {
		    const fragment = fragments[chidx];
		    if (fragment.startTime < currentTime) {
			console.log ('Fragment ' + fragment.fragmentName + ' overlaps previous content - delaying to ' + (currentTime + 0.1));
			fragment.startTime = currentTime + 0.1;
		    } else if (fragment.startTime < currentTime + 0.1) {
			console.log ('Fragment ' + fragment.fragmentName + ' nearly overlaps previous content - delaying to ' + (currentTime + 0.1));
			fragment.startTime = currentTime + 0.1;
		    }
		    if (debug) {
		        console.log ('Silence: ' + (fragment.startTime - currentTime));
		        console.log (fragment.fragmentName + ' (' + fragment.duration + ')');
		    }
		    currentTime = fragment.startTime + fragment.duration;
		}
		if (debug) console.log ('Finished at ' + currentTime);
		const outname = arg.match(/\./) ? arg.replace(/\.[^.]*$/, audioExt) : arg + audioExt;
		await combineAudio (fragments, outname);
	}
    }
  }
}

main();
