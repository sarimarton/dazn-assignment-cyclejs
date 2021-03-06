import xs from 'xstream';
import Snabbdom from 'snabbdom-pragma';

import css from './MovieDetailsPage.css';

export function MovieDetailsPage(sources) {
  const movieId$ =
    sources.movieId$;

  const movieTitle$ =
    sources.movieTitle$
    .startWith('')

  const detailsRequest$ =
    movieId$.map(id => ({
      url: sources.SvcUrl(`/movie/${id}`),
      category: 'details',
      isRequest: true // duck typing :(
    }))
    // Sadly we need this workaround to make loading work when landing on the movie page.
    .compose(sources.Time.delay(100));

  const detailsResponse$ =
    sources.HTTP
      .select('details')
      .map(resp$ =>
        resp$.replaceError(err => xs.of(err))
      )
      .flatten()
      .map(resp =>
        resp instanceof Error
          ? resp
          : JSON.parse(resp.text)
      );

  const creditsRequest$ =
    // We should derive it from movieId$, but then the request don't go out...
    // It might be a bug in xstream.
    detailsRequest$
      .map(detailsRequest => ({
        // :(
        // url: sources.SvcUrl(`/movie/${id}/credits`),
        url: detailsRequest.url.replace('?', '/credits?'),
        category: 'credits',
        isRequest: true // duck typing :(
      }))

  const creditsResponse$ =
    sources.HTTP
      .select('credits')
      .map(resp$ =>
        resp$.replaceError(err => xs.of(err))
      )
      .flatten()
      .map(resp =>
        resp instanceof Error
          ? resp
          : JSON.parse(resp.text)
      );

  const content$ =
    xs.combine(detailsResponse$, creditsResponse$)
      .startWith('');

  const isLoading$ =
    xs.merge(detailsRequest$, detailsResponse$)
      .map(r => Boolean(r && r.isRequest))
      .startWith(false);

  const isError$ =
    xs.merge(detailsRequest$, detailsResponse$)
      .map(r => r instanceof Error)
      .startWith(false);

  const MovieDetails = (details, cast) =>
    <div className="MovieDetailsPage">
      <div className="MovieDetailsPage__img-container uk-margin-right" style="float: left">
        <img src={`http://image.tmdb.org/t/p/w342${details.poster_path}`} alt="" />
      </div>
      <dl className="uk-description-list">
        <dt>Popularity</dt>
        <dd>{details.vote_average}</dd>
        <dt>Overview</dt>
        <dd>{details.overview}</dd>
        <dt>Genres</dt>
        <dd>{details.genres.map(g => g.name).join(', ')}</dd>
        <dt>Starring</dt>
        <dd>{cast.cast.slice(0, 3).map(cast => cast.name).join(', ')}</dd>
        <dt>Languages</dt>
        <dd>{details.spoken_languages.map(g => g.name).join(', ')}</dd>
        <dt>Original Title</dt>
        <dd>{details.original_title}</dd>
        <dt>Release Date</dt>
        <dd>{details.release_date}</dd>
        {details.imdb_id && <dt>IMDb URL</dt>}
        {details.imdb_id && <dd><a href={`https://www.imdb.com/title/${details.imdb_id}/`}>
            {`https://www.imdb.com/title/${details.imdb_id}/`}</a></dd>}
      </dl>
    </div>;

  const vdom$ =
    xs.combine(movieTitle$, content$, isLoading$, isError$)
      .map(([movieTitle, [details, cast], isLoading, isError]) => {
        return (
          <div>
            <h1>{movieTitle || details && details.title}</h1>
            <div>{isLoading ? 'Loading...' : ''}</div>
            <div>{isError ? 'Network error' : ''}</div>
            { details && !isLoading && !isError && MovieDetails(details, cast) }
          </div>
        );
      });

  const http$ = xs.merge(
    detailsRequest$,
    creditsRequest$
  );

  const navigation$ =
    sources.DOM
      .select('.App__view, .App__view-container')
      .events('click')
      .filter(event =>
        event.target.classList.contains('App__view') ||
        event.target.classList.contains('App__view-container')
      )
      .mapTo('/');

  return {
    DOM: vdom$,
    HTTP: http$,
    history: navigation$
  };
}
