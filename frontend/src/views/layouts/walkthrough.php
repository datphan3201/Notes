<dialog class="walkthrough-dialog" data-walkthrough aria-labelledby="walkthrough-title">
    <header class="walkthrough-header">
        <div><p class="walkthrough-label">Planner guide</p><p class="walkthrough-progress" data-walkthrough-progress></p></div>
        <button class="icon-button" type="button" data-walkthrough-dismiss aria-label="Close walkthrough" title="Close walkthrough">×</button>
    </header>
    <div class="walkthrough-topic field"><label for="walkthrough-topic">Choose a topic</label><select id="walkthrough-topic" data-walkthrough-topic></select></div>
    <section class="walkthrough-content" data-walkthrough-content tabindex="-1" aria-labelledby="walkthrough-title">
        <figure class="walkthrough-figure"><img data-walkthrough-image alt="Placeholder illustration of a workspace" width="800" height="360"><figcaption data-walkthrough-caption>Illustration placeholder · final UI images will be added later</figcaption></figure>
        <h2 id="walkthrough-title" data-walkthrough-title tabindex="-1"></h2>
        <p class="walkthrough-intro" data-walkthrough-intro></p>
        <ul class="walkthrough-instructions" data-walkthrough-instructions></ul>
    </section>
    <footer class="walkthrough-footer">
        <div class="walkthrough-feedback" hidden data-walkthrough-feedback><p class="field-error" role="alert" data-walkthrough-error></p><button class="text-button" type="button" data-walkthrough-close-now>Close for now</button></div>
        <div class="walkthrough-actions"><button class="button button-quiet" type="button" data-walkthrough-dismiss>Skip guide</button><div class="action-row"><button class="button button-quiet" type="button" data-walkthrough-back>Back</button><button class="button button-primary" type="button" data-walkthrough-next>Next</button></div></div>
        <span class="sr-only" role="status" data-walkthrough-status></span>
    </footer>
</dialog>
