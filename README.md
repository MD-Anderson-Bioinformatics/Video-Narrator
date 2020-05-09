# Video-Narrator
Use Google Cloud [text-to-speech api](https://cloud.google.com/text-to-speech/docs/basics) to narrate an audio track for a video

This tool uses Docker containers to build and run the convertor tool.  The example scripts
to build the container and invoke the convertor tool are written for Linux/Mac but should be easily modified for Windows.

## Creating the Convertor Tool

To use [Google cloud text-to-speech](https://cloud.google.com/text-to-speech/) you will first need to:
  * [create a Google Cloud project](https://cloud.google.com/resource-manager/docs/creating-managing-projects),
  * [activate billing](https://cloud.google.com/billing/docs/how-to/manage-billing-account),
  * [enable the text-to-speech api](https://cloud.google.com/text-to-speech/docs/quickstart-client-libraries), and
  * create an access key (step 4 in above document).

Save the resulting key in a local directory (say auth).

Run `build.sh` to create the Docker container.

Edit the `narrator.example.sh` script to contain the path to your key's directory and filename.

## Narration Script Format

Create a narration script.  A narration script contains one or voice fragments of the form:
```
start-time fragment-name [fragment-options...]
<speak>
SSML text.
</speak>
blank line
```

The format of start time is `[[hours:]minutes:]seconds[.milliseconds]`.

The fragment-name is used for issuing informative errors or messages and for saving
the generated audio in a cache to avoid repeated conversions of the same text.

Fragment options are zero or more options, each of the form name=value. The
following options are accepted:

* audio=file
* voice=file

In both cases, file is the name of file containing a
[text-to-speech object](https://cloud.google.com/text-to-speech/docs/reference/rpc/google.cloud.texttospeech.v1) in JSON format
(AudioConfig for audio, VoiceSelectionParams for voice).
The specified options will augment or override the default option.
Multiple options of the same type are permitted and processed from left to right.
The fragment-options affect only the current fragment;
they do not apply to subsequent fragments.

## Running the script to audio convertor

Use your edited `narrator.sh` script to convert the script into an audio (ogg) file:
```sh
narrator.sh [options] myvideo.script
```

On success, the narrated audio file will be in `myvideo.ogg`.  You can open `.ogg` files in both the Chrome and Firefox browsers.  The script cannot output an audio file in a different format.  Use a post-convertor. An example is included
in the comments of the example narration tool.

The script does not automatically add the audio track to your video file.  (Indeed, the video file need not even exist.) You can use existing tools (e.g. ffmpeg (command line) or Camtasia (Mac app)) to combine the video and audio tracks.

The program accepts the following options before the script file:

<dl>
<dt>-v</dt>
<dd>Be more verbose about the conversion process.</dd>
<dt>-y</dt>
<dd>Overwrite the audio output file.  If not specified, the system will output an error if
the audio output file already exists.</dd>
<dt>-audio file</dt>
<dd>Include additional audio options.  File should contain a text-to-speech AudioConfig object in JSON format.  Note: you cannot change the audio format. File should be in the current directory so that it's available inside the docker container.</dd>
<dt>-voice file</dt>
<dd>Override the default voice options.  File should contain a text-to-speech VoiceSelectionParams object in JSON format. File should be in the current directory so that it's available inside the docker container.</dd>
</dl>

Voice Narrator caches the translation of individual fragments in a subdirectory `fragment-cache` to avoid translating the same text multiple times during iterative script development.  If you change the audio or voice parameters you should empty the contents of this cache (`rm fragment-cache/*`) before running the narrator script.
